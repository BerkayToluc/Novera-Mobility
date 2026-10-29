import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { isUuid } from '../../common/uuid.js';
import { parseInput } from '../../common/zod-validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageOf, type Page } from '../admin-list.js';
import { inUse, staleWrite } from '../admin.errors.js';
import { createBranchSchema, listBranchSchema, updateBranchSchema } from './branches.schemas.js';
import { branchView, fold, type BranchUsage, type BranchView } from './branches.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Branch not found' }, HttpStatus.NOT_FOUND);

type Reads = Pick<PrismaService, 'vehicle'>;

// Active cars per branch, for the whole table in one query.
async function vehicleCounts(db: Reads): Promise<Map<string, number>> {
  const groups = await db.vehicle.groupBy({ by: ['branchId'], where: { active: true }, _count: { _all: true } });
  return new Map(groups.map((group) => [group.branchId, group._count._all]));
}

// The branches of the administration (V2-27, ADMIN.md §3.1). Like the campaign codes, the table is small and kept by hand
// (a few dozen rows), so a list reads it whole and filters, sorts and pages in memory. A branch is never deleted: it is
// closed and can be opened again, because past bookings carry its name.
@Injectable()
export class BranchesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<BranchView>> {
    const input = parseInput(listBranchSchema, query, 'Branch list query is invalid');
    const [rows, counts] = await Promise.all([this.prisma.branch.findMany(), vehicleCounts(this.prisma)]);
    let views = rows.map((row) => branchView(row, counts.get(row.id) ?? 0));

    const needle = input.q ? fold(input.q) : '';
    if (needle) views = views.filter((view) => fold(`${view.name} ${view.city} ${view.address}`).includes(needle));
    if (input.city) views = views.filter((view) => view.city === input.city);
    if (input.status) views = views.filter((view) => view.status === input.status);

    const { field: by, direction } = input.sort;
    const sign = direction === 'asc' ? 1 : -1;
    const key = (view: BranchView): number | string => (by === 'name' || by === 'city' ? fold(view[by]) : view[by]);
    views.sort((a, b) => {
      const left = key(a);
      const right = key(b);
      return sign * (left < right ? -1 : left > right ? 1 : 0) || a.name.localeCompare(b.name, 'tr');
    });
    return pageOf(views, input.page, input.pageSize);
  }

  // One branch and what keeps it open, so the screen can say why it cannot be closed before anyone presses the button.
  async get(id: string): Promise<BranchView & { usage: BranchUsage }> {
    const row = await this.find(id);
    const usage = await this.usageOf(this.prisma, row.id);
    return { ...branchView(row, usage.vehicles), usage };
  }

  async create(body: unknown): Promise<BranchView> {
    const input = parseInput(createBranchSchema, body, 'Branch validation failed');
    const row = await this.prisma.branch.create({ data: input });
    return branchView(row, 0);
  }

  // The branch row is locked first, the way a booking locks it for sharing: a booking being made and this change take turns.
  async update(id: string, body: unknown): Promise<BranchView> {
    this.assertId(id);
    const input = parseInput(updateBranchSchema, body, 'Branch validation failed');
    const { updatedAt, ...fields } = input;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.branch.findUnique({ where: { id } });
      if (!current) throw notFound();
      if (current.updatedAt.getTime() !== updatedAt.getTime()) throw staleWrite();
      const row = await tx.branch.update({ where: { id }, data: fields });
      return branchView(row, (await this.usageOf(tx, id)).vehicles);
    });
  }

  // Closing is refused while the branch is still in use (ADMIN.md §3.1): a booking that starts or ends there in the future,
  // a hold that is running, or a car that is switched on. The refusal says how many of each and changes nothing. A branch
  // that is already closed stays closed (the call can be repeated).
  async close(id: string, now: Date = new Date()): Promise<BranchView> {
    this.assertId(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.branch.findUnique({ where: { id } });
      if (!current) throw notFound();
      const usage = await this.usageOf(tx, id, now);
      if (current.closedAt) return branchView(current, usage.vehicles);
      if (usage.reservations > 0 || usage.holds > 0 || usage.vehicles > 0) {
        throw inUse('The branch is still in use; move the cars and wait for or cancel the bookings first', { ...usage });
      }
      const row = await tx.branch.update({ where: { id }, data: { closedAt: now } });
      return branchView(row, usage.vehicles);
    });
  }

  // Opening it again brings the branch back to the site as it was.
  async reopen(id: string): Promise<BranchView> {
    this.assertId(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.branch.findUnique({ where: { id } });
      if (!current) throw notFound();
      const row = current.closedAt ? await tx.branch.update({ where: { id }, data: { closedAt: null } }) : current;
      return branchView(row, (await this.usageOf(tx, id)).vehicles);
    });
  }

  // Bookings count when they are confirmed and the branch is where they start (pick-up still ahead) or where they end (the
  // return still ahead). A rental under way that has to come back here keeps the branch open until it is back.
  private async usageOf(
    db: Pick<PrismaService, 'reservation' | 'hold' | 'vehicle'>,
    id: string,
    now: Date = new Date(),
  ): Promise<BranchUsage> {
    const [reservations, holds, vehicles] = await Promise.all([
      db.reservation.count({
        where: {
          status: 'CONFIRMED',
          OR: [
            { pickupBranchId: id, startAt: { gt: now } },
            { returnBranchId: id, endAt: { gt: now } },
          ],
        },
      }),
      db.hold.count({ where: { expiresAt: { gt: now }, OR: [{ pickupBranchId: id }, { returnBranchId: id }] } }),
      db.vehicle.count({ where: { branchId: id, active: true } }),
    ]);
    return { reservations, holds, vehicles };
  }

  private assertId(id: string): void {
    if (!isUuid(id)) throw notFound();
  }

  private async find(id: string) {
    this.assertId(id);
    const row = await this.prisma.branch.findUnique({ where: { id } });
    if (!row) throw notFound();
    return row;
  }
}
