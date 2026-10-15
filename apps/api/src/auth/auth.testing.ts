import { randomUUID } from 'node:crypto';

// Yalnızca testler için: PrismaService'in auth'un kullandığı kısmını bellekte taklit eder.
// Böylece auth testleri veritabanı olmadan da çalışır (gerçek veritabanı testi için bkz. README).
type Row = Record<string, any>;

export class FakePrisma {
  users: Row[] = [];
  sessions: Row[] = [];

  user = {
    findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
      this.users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null,
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
        ...fields,
      };
      this.users.push(user);
      if (sessions?.create) {
        this.sessions.push({ id: randomUUID(), userId: user.id, ...sessions.create });
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
    create: async ({ data }: { data: Row }) => {
      const session = { id: randomUUID(), ...data };
      this.sessions.push(session);
      return session;
    },
    deleteMany: async ({ where }: { where: Row }) => {
      const before = this.sessions.length;
      this.sessions = this.sessions.filter((s) => {
        if (where.id && s.id !== where.id) return true;
        if (where.tokenHash && s.tokenHash !== where.tokenHash) return true;
        if (where.userId && s.userId !== where.userId) return true;
        if (where.expiresAt?.lt && !(s.expiresAt < where.expiresAt.lt)) return true;
        return false;
      });
      return { count: before - this.sessions.length };
    },
  };

  async $transaction(operations: Promise<unknown>[]): Promise<unknown[]> {
    return Promise.all(operations);
  }
}
