import { randomUUID } from 'node:crypto';

// Yalnızca testler için: PrismaService'in auth'un kullandığı kısmını bellekte taklit eder.
// Böylece auth testleri veritabanı olmadan da çalışır (gerçek veritabanı testi için bkz. README).
type Row = Record<string, any>;

export class FakePrisma {
  users: Row[] = [];
  sessions: Row[] = [];

  user = {
    findUnique: async ({ where }: { where: { email?: string; id?: string; googleSub?: string } }) =>
      this.users.find((u) =>
        where.email ? u.email === where.email : where.googleSub ? u.googleSub === where.googleSub : u.id === where.id,
      ) ?? null,
    create: async ({ data }: { data: Row }) => {
      const { sessions, ...fields } = data;
      if (this.users.some((u) => u.email === fields.email)) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      const user: Row = {
        id: randomUUID(),
        accountType: 'INDIVIDUAL',
        companyName: null,
        taxOffice: null,
        companyCity: null,
        companyPhone: null,
        contactTitle: null,
        salesContact: null,
        locale: 'TR',
        theme: 'LIGHT',
        currency: 'TRY',
        notifyReminders: true,
        notifyCampaigns: false,
        googleSub: null,
        ...fields,
      };
      this.users.push(user);
      if (sessions?.create) {
        this.sessions.push({ id: randomUUID(), createdAt: new Date(), lastUsedAt: new Date(), userId: user.id, ...sessions.create });
      }
      return user;
    },
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const user = this.users.find((u) => u.id === where.id);
      if (!user) throw new Error('Record not found');
      Object.assign(user, data);
      return user;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      this.users = this.users.filter((u) => u.id !== where.id);
      this.sessions = this.sessions.filter((s) => s.userId !== where.id); // cascade
    },
  };

  session = {
    findUnique: async ({ where }: { where: { tokenHash: string }; include?: unknown }) => {
      const session = this.sessions.find((s) => s.tokenHash === where.tokenHash);
      if (!session) return null;
      return { ...session, user: this.users.find((u) => u.id === session.userId) };
    },
    findMany: async ({ where }: { where: Row }) =>
      this.sessions
        .filter((s) => s.userId === where.userId && (!where.expiresAt?.gt || s.expiresAt > where.expiresAt.gt))
        .sort((a, b) => b.createdAt - a.createdAt),
    findFirst: async ({ where }: { where: Row }) =>
      this.sessions.find((s) => s.id === where.id && s.userId === where.userId) ?? null,
    create: async ({ data }: { data: Row }) => {
      const session = { id: randomUUID(), createdAt: new Date(), lastUsedAt: new Date(), ...data };
      this.sessions.push(session);
      return session;
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const rows = this.sessions.filter((s) => s.id === where.id);
      rows.forEach((s) => Object.assign(s, data));
      return { count: rows.length };
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = this.sessions.length;
      this.sessions = this.sessions.filter((s) => {
        if (where.id && s.id !== where.id) return true;
        if (typeof where.tokenHash === 'string' && s.tokenHash !== where.tokenHash) return true;
        if (where.tokenHash?.not && s.tokenHash === where.tokenHash.not) return true;
        if (where.userId && s.userId !== where.userId) return true;
        if (where.expiresAt?.lt && !(s.expiresAt < where.expiresAt.lt)) return true;
        return false;
      });
      return { count: before - this.sessions.length };
    },
  };

  // Sign-in waits (V2-10): the address is the key.
  throttles: Row[] = [];
  loginThrottle = {
    findUnique: async ({ where }: { where: { email: string } }) => this.throttles.find((t) => t.email === where.email) ?? null,
    upsert: async ({ where, create, update }: { where: { email: string }; create: Row; update: Row }) => {
      const existing = this.throttles.find((t) => t.email === where.email);
      if (existing) return Object.assign(existing, update, { updatedAt: new Date() });
      const row = { ...create, updatedAt: new Date() };
      this.throttles.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = this.throttles.length;
      this.throttles = this.throttles.filter((t) => !(where.email ? t.email === where.email : false));
      return { count: before - this.throttles.length };
    },
  };

  passwordResetToken: { deleteMany: (args: { where: Row }) => Promise<{ count: number }> } = {
    deleteMany: async () => ({ count: 0 }),
  };

  async $transaction(operations: Promise<unknown>[]): Promise<unknown[]> {
    return Promise.all(operations);
  }
}