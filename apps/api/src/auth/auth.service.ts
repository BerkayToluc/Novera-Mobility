import { Inject, Injectable } from '@nestjs/common';
import { erasedQuoteFields } from '../forms/retention.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { parseInput } from '../common/zod-validation.js';
import { emailTaken, invalidCredentials } from './auth.errors.js';
import {
  LOCALES,
  THEMES,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.schemas.js';
import { cleanUserAgent } from './device.js';
import {
  hashPassword,
  needsRehash,
  verifyAgainstDummy,
  verifyPassword,
} from './password.js';
import { RateLimitedException } from '../common/rate-limit.js';
import {
  SESSION_DAYS,
  SESSION_IDLE_DAYS,
  SESSION_TOUCH_MINUTES,
  hashSessionToken,
  newSessionToken,
} from './session-token.js';
import {
  failureWait,
  FREE_FAILED_ATTEMPTS,
  THROTTLE_MEMORY_MS,
} from './login-throttle.js';
import type { UserRow } from './user-view.js';
import { DAY_MS } from '../common/time.js';

// BACKLOG #34 (kayıt, giriş, çıkış) ve #36/#37 (/me): openapi.yaml auth ve me uçları.

export interface SessionStart {
  user: UserRow;
  token: string;
  expiresAt: Date;
}


@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(
    input: unknown,
    userAgent: unknown = null,
  ): Promise<SessionStart> {
    const { email, firstName, lastName, password } = parseInput(
      registerSchema,
      input,
      'Registration data is invalid',
    );

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
          sessions: {
            create: {
              tokenHash: hashSessionToken(token),
              expiresAt,
              userAgent: cleanUserAgent(userAgent),
            },
          },
        },
      });
      return { user, token, expiresAt };
    } catch (error) {
      // İki istek aynı anda aynı e-postayla geldiyse ikincisini veritabanı reddeder.
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }

  async login(
    input: unknown,
    userAgent: unknown = null,
  ): Promise<SessionStart> {
    const { email, password } = parseInput(
      loginSchema,
      input,
      'Login data is invalid',
    );

    // An address that failed too often has to wait (1, 2, 4 ... at most 15 minutes), the same whether or not it has
    // an account, and also for the right password until the wait is over (QUALITY G-15).
    const throttle = await this.prisma.loginThrottle.findUnique({
      where: { email },
    });
    if (throttle?.lockedUntil && throttle.lockedUntil.getTime() > Date.now()) {
      throw new RateLimitedException(
        Math.ceil((throttle.lockedUntil.getTime() - Date.now()) / 1000),
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await verifyAgainstDummy(password);
      await this.recordFailure(email);
      throw invalidCredentials();
    }
    if (user.passwordHash === null) {
      // Google-only account: same work and same answer as a wrong password.
      await verifyAgainstDummy(password);
      await this.recordFailure(email);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      await this.recordFailure(email);
      throw invalidCredentials();
    }
    if (throttle)
      await this.prisma.loginThrottle.deleteMany({ where: { email } });

    // The password is known only now: a hash made with an older, cheaper setting is replaced (QUALITY G-12).
    if (needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await this.prisma.$transaction([
      this.prisma.session.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
      }),
      this.prisma.session.create({
        data: {
          tokenHash: hashSessionToken(token),
          expiresAt,
          userId: user.id,
          userAgent: cleanUserAgent(userAgent),
        },
      }),
    ]);
    return { user, token, expiresAt };
  }

  // Counts a failed sign-in for this address and, past the free attempts, sets how long it has to wait. A row that
  // has not been touched for an hour starts again from one.
  private async recordFailure(email: string): Promise<void> {
    const now = Date.now();
    const row = await this.prisma.loginThrottle.findUnique({
      where: { email },
    });
    const failures =
      row && now - row.updatedAt.getTime() < THROTTLE_MEMORY_MS
        ? row.failures + 1
        : 1;
    const wait = failures > FREE_FAILED_ATTEMPTS ? failureWait(failures) : 0;
    const lockedUntil = wait > 0 ? new Date(now + wait) : null;
    await this.prisma.loginThrottle.upsert({
      where: { email },
      create: { email, failures, lockedUntil },
      update: { failures, lockedUntil },
    });
  }

  // Çıkış: oturum kaydı silinir, çerez çalınmış olsa bile artık işe yaramaz.
  async logout(token: string | null): Promise<void> {
    if (!token) return;
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  // Çerezdeki anahtardan kullanıcıyı bulur; yoksa, süresi dolmuşsa ya da 7 gündür kullanılmıyorsa null.
  async authenticate(token: string): Promise<UserRow | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    if (!session) return null;
    const now = Date.now();
    const lastUsed = (session.lastUsedAt ?? session.createdAt).getTime();
    if (
      session.expiresAt.getTime() <= now ||
      now - lastUsed > SESSION_IDLE_DAYS * DAY_MS
    ) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    if (now - lastUsed > SESSION_TOUCH_MINUTES * 60_000) {
      await this.prisma.session.updateMany({
        where: { id: session.id },
        data: { lastUsedAt: new Date(now) },
      });
    }
    return session.user;
  }

  // PATCH /me: yalnızca gönderilen alanlar güncellenir. E-posta değiştirilemez (gelirse yok sayılır).
  async updateProfile(userId: string, input: unknown): Promise<UserRow> {
    const body = parseInput(
      updateProfileSchema,
      input,
      'Profile data is invalid',
    );
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
    if (body.notifications?.reminders !== undefined)
      data.notifyReminders = body.notifications.reminders;
    if (body.notifications?.campaigns !== undefined)
      data.notifyCampaigns = body.notifications.campaigns;
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  // DELETE /me: hesap kalıcı silinir. Oturumlar ve puanlar birlikte gider (cascade). Rezervasyon kayıtları kalır,
  // kullanıcı bağlantısı boşalır: araç, tarih ve tutar kiralama kaydıdır, kişi bilgisi değil. Teklif taleplerinde ise
  // ad, e-posta, telefon ve notlar hemen silinir (V2-12, KVKK); firma adı ve talep edilen araç istatistik için kalır.
  // İkisi tek işlemde olur: teklifler silinmeden hesap gitmez.
  async deleteAccount(userId: string, now: Date = new Date()): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.quoteRequest.updateMany({ where: { userId }, data: erasedQuoteFields(now) }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }
}
