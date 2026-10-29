import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  // Who did it: an account id, or `cli` for what `pnpm admin:create` does.
  actorId: string;
  companyId?: string | null;
  // `branch.close`, `admin.grant` ...
  action: string;
  entity: string;
  entityId?: string | null;
  // The NAMES of the fields that changed, never their values.
  fields: readonly string[];
}

// A field name is a plain identifier. Anything else a caller managed to put in a body key (a value, a sentence, an
// address) is dropped, so the log cannot be made to hold personal data through a key.
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;
const MAX_FIELDS = 50;

export function fieldNamesOf(body: unknown): string[] {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.keys(body)
    .filter((name) => FIELD_NAME.test(name))
    .slice(0, MAX_FIELDS);
}

// The audit log (ADR-24). It only adds: there is no method here that changes or removes a record, and the database
// refuses UPDATE and DELETE on the table as well (migration 20261030100000).
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        companyId: entry.companyId ?? null,
        action: entry.action.slice(0, 120),
        entity: entry.entity.slice(0, 120),
        entityId: entry.entityId ?? null,
        fields: entry.fields.filter((name) => FIELD_NAME.test(name)).slice(0, MAX_FIELDS),
      },
    });
  }
}
