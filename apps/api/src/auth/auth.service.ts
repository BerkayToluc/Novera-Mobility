import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseInput } from '../common/zod-validation.js';
import { emailTaken, invalidCredentials } from './auth.errors.js';
import { LOCALES, THEMES, loginSchema, registerSchema, updateProfileSchema } from './auth.schemas.js';
import { cleanUserAgent } from './device.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';
import { SESSION_DAYS, hashSessionToken, newSessionToken } from './session-token.js';
import type { UserRow } from './user-view.js';

// BACKLOG #34 (kayıt, giriş, çıkış) ve #36/#37 (/me): openapi.yaml auth ve me uçları.
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SessionStart {
  user: UserRow;
  token: string;
  expiresAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(input: unknown, userAgent: unknown = null): Promise<SessionStart> {
    const { email, firstName, lastName, password } = parseInput(registerSchema, input, 'Registration data is invalid');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw emailTaken();

    const passwordHash = await hashPassword(password);
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          sessions: { create: { tokenHash: hashSessionToken(token), expiresAt, userAgent: cleanUserAgent(userAgent) } },
        },
      });
      return { user, token, expiresAt };
    } catch (error) {
      // İki istek aynı anda aynı e-postayla geldiyse ikincisini veritabanı reddeder.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }

  async login(input: unknown, userAgent: unknown = null): Promise<SessionStart> {
    const { email, password } = parseInput(loginSchema, input, 'Login data is invalid');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await verifyAgainstDummy(password);
      throw invalidCredentials();
    }
    if (user.passwordHash === null) {
      // Google-only account: same work and same answer as a wrong password.
      await verifyAgainstDummy(password);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(password, user.passwordHash))) throw invalidCredentials();

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
      }),
      this.prisma.session.create({
        data: { tokenHash: hashSessionToken(token), expiresAt, userId: user.id, userAgent: cleanUserAgent(userAgent) },
      }),
    ]);
    return { user, token, expiresAt };
  }

  // Çıkış: oturum kaydı silinir, çerez çalınmış olsa bile artık işe yaramaz.
  async logout(token: string | null): Promise<void> {
    if (!token) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  // Çerezdeki anahtardan kullanıcıyı bulur; yoksa ya da süresi dolmuşsa null.
  async authenticate(token: string): Promise<UserRow | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    return session.user;
  }

  // PATCH /me: yalnızca gönderilen alanlar güncellenir. E-posta değiştirilemez (gelirse yok sayılır).
  async updateProfile(userId: string, input: unknown): Promise<UserRow> {
    const body = parseInput(updateProfileSchema, input, 'Profile data is invalid');
    const data: {
      firstName?: string;
      lastName?: string;
      locale?: 'TR' | 'EN';
      theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
      currency?: 'TRY' | 'EUR' | 'USD';
      notifyReminders?: boolean;
      notifyCampaigns?: boolean;
    } = {};
    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.locale !== undefined) data.locale = LOCALES[body.locale];
    if (body.theme !== undefined) data.theme = THEMES[body.theme];
    if (body.currency !== undefined) data.currency = body.currency;
    // E-posta tercihleri: { notifications: { reminders?: boolean, campaigns?: boolean } }, gönderilen alan güncellenir.
    if (body.notifications?.reminders !== undefined) data.notifyReminders = body.notifications.reminders;
    if (body.notifications?.campaigns !== undefined) data.notifyCampaigns = body.notifications.campaigns;
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  // DELETE /me: hesap kalıcı silinir. Oturumlar ve puanlar birlikte gider (cascade);
  // rezervasyon kayıtları kalır, kullanıcı bağlantısı boşalır (anonim). Teklif talepleri de öyle.
  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
