import { Inject, Injectable } from '@nestjs/common';
import type { Page } from '../admin/admin-list.js';
import { invalidTransition, staleWrite } from '../admin/admin.errors.js';
import { istanbulDateStart } from '../common/time.js';
import { isUuid } from '../common/uuid.js';
import { parseInput } from '../common/zod-validation.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assigneeAt, canMoveExpense } from './expense-calc.js';
import { listFleetExpenseSchema, reflectExpensesSchema, setExpenseStatusSchema } from './expense.schemas.js';
import { EXPENSE_INCLUDE, expenseView, expenseViews, loadAssignees, type ExpenseView } from './expense.view.js';
import { fleetNotFound } from './fleet.errors.js';

export type ReflectResult = { reflected: number; skipped: { id: string; reason: 'NOT_OPEN' | 'NO_ASSIGNEE' }[] };

// The expenses of the signed-in company (V2-38, docs/FLEET.md §3.1, §4.1). Every query takes the company and filters by it first: an
// expense of another company is never found, so it is a 404 like one that does not exist (ADR-25). The person of an expense is worked out
// from the assignments when it is read (expense-calc.ts) and never stored.
@Injectable()
export class FleetExpensesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // The expenses whose person is `employee` (or nobody, for `none`), as ids. The person is not a column, so the filter asks the same
  // question the screen does: of the assignments that had the car at that moment, the one that started last. One query, company first.
  private async idsOfEmployee(companyId: string, employee: string): Promise<string[]> {
    const rows =
      employee === 'none'
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT e."id" FROM "FleetExpense" e
            WHERE e."companyId" = ${companyId}
              AND NOT EXISTS (
                SELECT 1 FROM "VehicleAssignment" a
                WHERE a."fleetVehicleId" = e."fleetVehicleId" AND a."startedAt" <= e."occurredAt" AND (a."endedAt" IS NULL OR a."endedAt" > e."occurredAt")
              )`
        : await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT e."id" FROM "FleetExpense" e
            WHERE e."companyId" = ${companyId}
              AND (
                SELECT a."employeeId" FROM "VehicleAssignment" a
                WHERE a."fleetVehicleId" = e."fleetVehicleId" AND a."startedAt" <= e."occurredAt" AND (a."endedAt" IS NULL OR a."endedAt" > e."occurredAt")
                ORDER BY a."startedAt" DESC, a."id" ASC LIMIT 1
              ) = ${employee}`;
    return rows.map((row) => row.id);
  }

  async list(companyId: string, query: unknown): Promise<Page<ExpenseView>> {
    const input = parseInput(listFleetExpenseSchema, query, 'Expense list query is invalid');
    const where: Prisma.FleetExpenseWhereInput = {
      companyId,
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.vehicle ? { fleetVehicleId: input.vehicle } : {}),
      ...(input.from || input.to
        ? { occurredAt: { ...(input.from ? { gte: istanbulDateStart(input.from) } : {}), ...(input.to ? { lt: istanbulDateStart(input.to, 1) } : {}) } }
        : {}),
      ...(input.employee ? { id: { in: await this.idsOfEmployee(companyId, input.employee) } } : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.fleetExpense.count({ where }),
      this.prisma.fleetExpense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        // The id as the last key: expenses that share a value still come in one order, so a page never repeats or skips one.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: await expenseViews(this.prisma, rows), total, page: input.page, pageSize: input.pageSize };
  }

  async get(companyId: string, id: string): Promise<ExpenseView> {
    if (!isUuid(id)) throw fleetNotFound('Expense');
    const row = await this.prisma.fleetExpense.findFirst({ where: { id, companyId }, include: EXPENSE_INCLUDE });
    if (!row) throw fleetNotFound('Expense');
    return (await expenseViews(this.prisma, [row]))[0]!;
  }

  // Open ↔ disputed, and open → reflected (FLEET.md §3.1). The row is locked, so two edits take turns and the second is refused
  // (`409 STALE_WRITE`) if it was made against an older copy. Asking for the state it is in already changes nothing and is no error.
  // An expense cannot be reflected to nobody: it needs a person at the moment it happened.
  async setStatus(companyId: string, id: string, body: unknown): Promise<ExpenseView> {
    if (!isUuid(id)) throw fleetNotFound('Expense');
    const input = parseInput(setExpenseStatusSchema, body, 'Expense validation failed');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FleetExpense" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
      const current = await tx.fleetExpense.findFirst({ where: { id, companyId }, include: EXPENSE_INCLUDE });
      if (!current) throw fleetNotFound('Expense');
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();
      const index = await loadAssignees(tx, [current]);
      if (current.status === input.status) return expenseView(current, index);
      if (!canMoveExpense(current.status, input.status)) throw invalidTransition(`An expense that is ${current.status} cannot become ${input.status}`);
      if (input.status === 'REFLECTED' && !assigneeAt(index.get(current.fleetVehicleId) ?? [], current.occurredAt)) {
        throw invalidTransition('Nobody had the vehicle when this happened; there is no one to reflect it to');
      }
      const row = await tx.fleetExpense.update({ where: { id }, data: { status: input.status }, include: EXPENSE_INCLUDE });
      return expenseView(row, index);
    });
  }

  // Reflect many at once. An id that is not the company's (another company's, or none at all) refuses the whole call with a 404 and
  // changes nothing; it must not tell the two apart. Of the company's own, only the open ones that had a person are changed; the others
  // stay as they are and are named with the reason, so the screen can say what was left.
  async reflect(companyId: string, body: unknown): Promise<ReflectResult> {
    const { ids } = parseInput(reflectExpensesSchema, body, 'Expense validation failed');

    return this.prisma.$transaction(async (tx) => {
      // Locked in id order, so two calls that overlap take turns instead of waiting for each other.
      await tx.$queryRaw`SELECT "id" FROM "FleetExpense" WHERE "companyId" = ${companyId} AND "id" = ANY(${ids}::text[]) ORDER BY "id" FOR UPDATE`;
      const rows = await tx.fleetExpense.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, status: true, fleetVehicleId: true, occurredAt: true }, orderBy: { id: 'asc' } });
      if (rows.length !== ids.length) throw fleetNotFound('Expense');

      const index = await loadAssignees(tx, rows);
      const changeable: string[] = [];
      const skipped: ReflectResult['skipped'] = [];
      for (const row of rows) {
        if (row.status !== 'OPEN') skipped.push({ id: row.id, reason: 'NOT_OPEN' });
        else if (!assigneeAt(index.get(row.fleetVehicleId) ?? [], row.occurredAt)) skipped.push({ id: row.id, reason: 'NO_ASSIGNEE' });
        else changeable.push(row.id);
      }
      if (changeable.length > 0) await tx.fleetExpense.updateMany({ where: { companyId, id: { in: changeable }, status: 'OPEN' }, data: { status: 'REFLECTED' } });
      return { reflected: changeable.length, skipped };
    });
  }
}
