import { Inject, Injectable } from '@nestjs/common';
import { MINUTE_MS, istanbulDateStart } from '../../common/time.js';
import { isUuid } from '../../common/uuid.js';
import { parseInput, validationFailed } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { createExpenseSchema, listAdminExpenseSchema, updateExpenseSchema } from '../../fleet/expense.schemas.js';
import { EXPENSE_INCLUDE, expenseViews, type ExpenseView } from '../../fleet/expense.view.js';
import { fleetNotFound } from '../../fleet/fleet.errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Page } from '../admin-list.js';
import { invalidTransition, staleWrite } from '../admin.errors.js';

// How far ahead of the clock a moment may be: a minute, for the clocks of two computers that do not agree.
const CLOCK_SLACK_MS = MINUTE_MS;

// The expenses of the fleets, entered by the administration (V2-38, docs/ADMIN.md §3.16): HGS, penalties and maintenance, by the plate of
// the car. The company is the car's, so it can be neither chosen nor mixed up. The person is worked out from the assignments when an
// expense is read, so nothing here says who it is for (ADR-25).
@Injectable()
export class AdminFleetExpensesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<ExpenseView>> {
    const input = parseInput(listAdminExpenseSchema, query, 'Expense list query is invalid');
    const where: Prisma.FleetExpenseWhereInput = {
      ...(input.company ? { companyId: input.company } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.vehicle ? { fleetVehicleId: input.vehicle } : {}),
      ...(input.q ? { vehicle: { is: { plate: { contains: input.q, mode: 'insensitive' } } } } : {}),
      ...(input.from || input.to
        ? { occurredAt: { ...(input.from ? { gte: istanbulDateStart(input.from) } : {}), ...(input.to ? { lt: istanbulDateStart(input.to, 1) } : {}) } }
        : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.fleetExpense.count({ where }),
      this.prisma.fleetExpense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: await expenseViews(this.prisma, rows), total, page: input.page, pageSize: input.pageSize };
  }

  async get(id: string): Promise<ExpenseView> {
    if (!isUuid(id)) throw fleetNotFound('Expense');
    const row = await this.prisma.fleetExpense.findUnique({ where: { id }, include: EXPENSE_INCLUDE });
    if (!row) throw fleetNotFound('Expense');
    return (await expenseViews(this.prisma, [row]))[0]!;
  }

  // The plate finds the car, and the car's company is the expense's company. A plate that is no car of any fleet is a field problem
  // (`UNKNOWN_REFERENCE`), not a 404: the form can say which field is wrong. A car that was given back can still have a cost that
  // happened while it was out.
  async create(body: unknown, now: Date = new Date()): Promise<ExpenseView> {
    const input = parseInput(createExpenseSchema, body, 'Expense validation failed');
    if (input.occurredAt.getTime() > now.getTime() + CLOCK_SLACK_MS) throw validationFailed({ occurredAt: 'OUT_OF_RANGE' }, 'An expense cannot be in the future');
    const vehicle = await this.prisma.fleetVehicle.findUnique({ where: { plate: input.plate }, select: { id: true, companyId: true } });
    if (!vehicle) throw validationFailed({ plate: 'UNKNOWN_REFERENCE' }, 'No fleet vehicle has this plate');
    const row = await this.prisma.fleetExpense.create({
      data: {
        companyId: vehicle.companyId,
        fleetVehicleId: vehicle.id,
        type: input.type,
        occurredAt: input.occurredAt,
        amount: input.amount,
        description: input.description,
        place: input.place,
      },
      include: EXPENSE_INCLUDE,
    });
    return (await expenseViews(this.prisma, [row]))[0]!;
  }

  // A correction. A reflected expense is final: it was charged to a person, so what it says cannot change under them (409
  // INVALID_TRANSITION); the open and the disputed ones can be corrected (a dispute is often a wrong amount). The row is locked, so two
  // edits take turns, and the second is refused (`409 STALE_WRITE`) if it was made against an older copy.
  async update(id: string, body: unknown, now: Date = new Date()): Promise<ExpenseView> {
    if (!isUuid(id)) throw fleetNotFound('Expense');
    const input = parseInput(updateExpenseSchema, body, 'Expense validation failed');
    if (input.occurredAt && input.occurredAt.getTime() > now.getTime() + CLOCK_SLACK_MS) throw validationFailed({ occurredAt: 'OUT_OF_RANGE' }, 'An expense cannot be in the future');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FleetExpense" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.fleetExpense.findUnique({ where: { id }, select: { updatedAt: true, status: true } });
      if (!current) throw fleetNotFound('Expense');
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();
      if (current.status === 'REFLECTED') throw invalidTransition('A reflected expense cannot be changed');
      const { updatedAt: _version, ...changes } = input;
      void _version;
      const row = await tx.fleetExpense.update({ where: { id }, data: changes, include: EXPENSE_INCLUDE });
      return (await expenseViews(tx, [row]))[0]!;
    });
  }
}
