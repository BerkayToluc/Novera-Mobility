import { randomUUID } from 'node:crypto';
import { ADMIN_PASSWORD_MIN } from '../auth/admin-rules.js';
import { hashPassword } from '../auth/password.js';
import { isCommonPassword } from '../common/common-passwords.js';
import { PASSWORD_MAX } from '../common/zod-fields.js';
import type { PrismaService } from '../prisma/prisma.service.js';

// What `pnpm admin:create` does (V2-23, ADR-24, docs/ADMIN.md §2). The terminal part is in admin-create.ts; this is the
// part a test can drive. An administrator account is opened or revoked only here, never from the site.

// The only part of the database it needs; a test hands in a fake.
type Db = Pick<PrismaService, 'user' | 'session' | 'passwordResetToken' | 'auditLog' | '$transaction'>;

export class AdminAccountError extends Error {}

export interface GrantInput {
  email: string;
  // "First Last": the last word is the surname. Needed for a new account, optional for an existing one.
  name?: string;
  password: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export function assertEmail(value: string): string {
  const email = normalizeEmail(value);
  if (!EMAIL.test(email) || email.length > 254) throw new AdminAccountError('The e-mail address is not valid.');
  return email;
}

// The rule for an administrator's password: 12 characters at least, and not on the list of common passwords. The
// message says which rule, never the password.
export function assertAdminPassword(password: string): void {
  if (password.length < ADMIN_PASSWORD_MIN) {
    throw new AdminAccountError(`The password needs at least ${ADMIN_PASSWORD_MIN} characters.`);
  }
  if (password.length > PASSWORD_MAX) throw new AdminAccountError(`The password is longer than ${PASSWORD_MAX} characters.`);
  if (isCommonPassword(password)) throw new AdminAccountError('That password is on the list of common passwords.');
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) throw new AdminAccountError('--name needs a first and a last name, e.g. --name "Ada Lovelace".');
  return { firstName: parts.slice(0, -1).join(' ').slice(0, 80), lastName: parts.at(-1)!.slice(0, 80) };
}

// Opens an administrator account, or gives the role to an existing one. Either way the password is set now (an existing
// account's may be a short one from before), every open session and reset link of the account goes (they were made
// under other rules), and the grant is written to the audit log with `cli` as the actor.
export async function grantAdmin(db: Db, input: GrantInput): Promise<{ id: string; created: boolean }> {
  const email = assertEmail(input.email);
  assertAdminPassword(input.password);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.accountType !== 'INDIVIDUAL') {
    throw new AdminAccountError('That is a corporate account. An administrator is a separate account of its own.');
  }
  const passwordHash = await hashPassword(input.password);

  if (existing) {
    await db.$transaction([
      db.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', passwordHash } }),
      db.session.deleteMany({ where: { userId: existing.id } }),
      db.passwordResetToken.deleteMany({ where: { userId: existing.id } }),
      db.auditLog.create({
        data: { actorId: 'cli', action: 'admin.grant', entity: 'user', entityId: existing.id, fields: ['role', 'password'] },
      }),
    ]);
    return { id: existing.id, created: false };
  }

  if (!input.name) throw new AdminAccountError('No account has that e-mail address. Add --name "First Last" to open one.');
  const { firstName, lastName } = splitName(input.name);
  // The account and its record go in together: no administrator exists without the line that says who made it.
  const id = randomUUID();
  await db.$transaction([
    db.user.create({ data: { id, email, passwordHash, firstName, lastName, role: 'ADMIN' } }),
    db.auditLog.create({
      data: { actorId: 'cli', action: 'admin.grant', entity: 'user', entityId: id, fields: ['role', 'password', 'email', 'name'] },
    }),
  ]);
  return { id, created: true };
}

// Takes the role away and closes every open session. The account stays, as an ordinary customer's.
export async function revokeAdmin(db: Db, emailInput: string): Promise<{ id: string }> {
  const email = assertEmail(emailInput);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new AdminAccountError('No account has that e-mail address.');
  if (user.role !== 'ADMIN') throw new AdminAccountError('That account is not an administrator.');
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: 'CUSTOMER' } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.auditLog.create({ data: { actorId: 'cli', action: 'admin.revoke', entity: 'user', entityId: user.id, fields: ['role'] } }),
  ]);
  return { id: user.id };
}
