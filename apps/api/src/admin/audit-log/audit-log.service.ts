import { Inject, Injectable } from '@nestjs/common';
import { istanbulDateStart } from '../../common/time.js';
import { parseInput } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Page } from '../admin-list.js';
import { listAuditSchema } from './audit-log.schemas.js';

// A line of the audit log as the screen shows it: who, when, what, to which record, and the NAMES of the fields (never their values).
export type AuditEntryItem = {
  id: string;
  at: string;
  // The account that did it. `cli` is a person at the terminal (`pnpm admin:create`); an account that has been deleted since has no name.
  actor: { id: string; name: string | null; email: string | null };
  action: string;
  entity: string;
  entityId: string | null;
  companyId: string | null;
  fields: string[];
};

// The audit log of the administration (V2-34, ADMIN.md §3.11). It only reads: the log is written by the interceptor and nothing in
// the API changes or removes a line (the database refuses it too). The person's name and e-mail address are read from the account
// at the moment of reading, so they are never copied into the log.
@Injectable()
export class AuditLogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<AuditEntryItem>> {
    const input = parseInput(listAuditSchema, query, 'Audit log query is invalid');
    const where: Prisma.AuditLogWhereInput = {
      ...(input.actor ? { actorId: input.actor } : {}),
      ...(input.entity ? { entity: input.entity } : {}),
      // The days both included, by the Istanbul calendar: [start of `from`, start of the day after `to`).
      ...(input.from || input.to
        ? {
            at: {
              ...(input.from ? { gte: istanbulDateStart(input.from) } : {}),
              ...(input.to ? { lt: istanbulDateStart(input.to, 1) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        // The id as the last key: lines of one moment still come in one order, so a page never repeats or skips one.
        orderBy: [{ at: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);

    // `actorId` is not a foreign key (`cli` is not an account), so the names are read in one go.
    const ids = [...new Set(rows.map((row) => row.actorId).filter((id) => id !== 'cli'))];
    const actors = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, firstName: true, lastName: true } })
      : [];
    const byId = new Map(actors.map((user) => [user.id, user]));

    return {
      items: rows.map((row) => {
        const user = byId.get(row.actorId);
        return {
          id: row.id,
          at: row.at.toISOString(),
          actor: { id: row.actorId, name: user ? `${user.firstName} ${user.lastName}`.trim() : null, email: user?.email ?? null },
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          companyId: row.companyId,
          fields: row.fields,
        };
      }),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
}
