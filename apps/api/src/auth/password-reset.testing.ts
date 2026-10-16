import { randomUUID } from 'node:crypto';
import { FakePrisma } from './auth.testing.js';

type Row = Record<string, any>;

// Tests only: the auth fake plus the reset-token table, in memory.
export class PasswordResetFake extends FakePrisma {
  resetTokens: Row[] = [];

  passwordResetToken = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      this.resetTokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
    create: async ({ data }: { data: Row }) => {
      const row = { id: randomUUID(), usedAt: null, createdAt: new Date(), ...data };
      this.resetTokens.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = this.resetTokens.length;
      this.resetTokens = this.resetTokens.filter((t) => {
        if (where.userId && t.userId !== where.userId) return true;
        if (where.usedAt === null && t.usedAt !== null) return true;
        return false;
      });
      return { count: before - this.resetTokens.length };
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const matches = this.resetTokens.filter(
        (t) => t.id === where.id && (where.usedAt !== null || t.usedAt === null),
      );
      for (const row of matches) Object.assign(row, data);
      return { count: matches.length };
    },
  };
}
