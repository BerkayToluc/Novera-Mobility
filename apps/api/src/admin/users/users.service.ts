import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { isUuid } from '../../common/uuid.js';
import { parseInput } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Page } from '../admin-list.js';
import { forbidden } from '../admin.errors.js';
import { listUserSchema } from './users.schemas.js';
import { userDetail, userListItem, type UserDetail, type UserListItem } from './users.view.js';

const notFound = (): HttpException => new HttpException({ code: 'NOT_FOUND', message: 'User not found' }, HttpStatus.NOT_FOUND);

const INCLUDE = { company: { select: { id: true, name: true } } } as const;
const MAX_WORDS = 4;

// The accounts of the administration (V2-34, ADMIN.md §3.11): who they are, and closing or opening one. The list is a database
// query: the filters, the order and the page are the database's.
@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<UserListItem>> {
    const input = parseInput(listUserSchema, query, 'User list query is invalid');
    // "ada lovelace" finds the account whose name has both words; every word may sit in the e-mail address or in either name.
    const words = (input.q ?? '').split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
    const where: Prisma.UserWhereInput = {
      ...(input.type === 'ADMIN' ? { role: 'ADMIN' } : input.type ? { role: 'CUSTOMER', accountType: input.type } : {}),
      ...(input.status === 'DISABLED' ? { disabledAt: { not: null } } : input.status === 'ACTIVE' ? { disabledAt: null } : {}),
      ...(words.length
        ? {
            AND: words.map((word) => ({
              OR: [
                { email: { contains: word, mode: 'insensitive' as const } },
                { firstName: { contains: word, mode: 'insensitive' as const } },
                { lastName: { contains: word, mode: 'insensitive' as const } },
              ],
            })),
          }
        : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: INCLUDE,
        // The id as the last key: accounts that share a value still come in one order, so a page never repeats or skips one.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(userListItem), total, page: input.page, pageSize: input.pageSize };
  }

  async get(id: string, now: Date = new Date()): Promise<UserDetail> {
    if (!isUuid(id)) throw notFound();
    const row = await this.prisma.user.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw notFound();
    return this.detail(this.prisma, row, now);
  }

  // Closing an account: it cannot sign in (password or Google, the same refusal as a wrong password) and every open session and
  // reset link goes at once. The account and its bookings stay: bookings still to come are not cancelled, the screen says how many.
  // An administrator is not closed from here (not oneself, not another one): that is `pnpm admin:create`'s to revoke. Closing an
  // account that is closed already changes nothing, and keeps the first date.
  async disable(id: string, now: Date = new Date()): Promise<UserDetail> {
    if (!isUuid(id)) throw notFound();
    return this.prisma.$transaction(async (tx) => {
      // The account is locked, so a sign-in that is happening at the same moment is either before (and its session goes with the rest) or
      // after (and finds the account closed).
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id }, include: INCLUDE });
      if (!current) throw notFound();
      if (current.role === 'ADMIN') throw forbidden();
      if (current.disabledAt) return this.detail(tx, current, now);
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      const row = await tx.user.update({ where: { id }, data: { disabledAt: now }, include: INCLUDE });
      return this.detail(tx, row, now);
    });
  }

  // Opening it again: it signs in as before. It has no sessions (they went when it was closed), so it signs in anew.
  async enable(id: string, now: Date = new Date()): Promise<UserDetail> {
    if (!isUuid(id)) throw notFound();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id }, include: INCLUDE });
      if (!current) throw notFound();
      if (!current.disabledAt) return this.detail(tx, current, now);
      const row = await tx.user.update({ where: { id }, data: { disabledAt: null }, include: INCLUDE });
      return this.detail(tx, row, now);
    });
  }

  private async detail(
    db: Pick<PrismaService, 'reservation' | 'pointTransaction'>,
    row: Parameters<typeof userDetail>[0],
    now: Date,
  ): Promise<UserDetail> {
    const [total, upcoming, points] = await Promise.all([
      db.reservation.count({ where: { userId: row.id } }),
      db.reservation.count({ where: { userId: row.id, status: 'CONFIRMED', startAt: { gt: now } } }),
      db.pointTransaction.aggregate({ where: { userId: row.id }, _sum: { points: true } }),
    ]);
    return userDetail(row, { total, upcoming }, points._sum.points ?? 0);
  }
}
