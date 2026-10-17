import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FormReader, rateLimited, validationFailed, type FormInput } from '../forms/form-input.js';
import { RateLimiter } from '../forms/rate-limiter.js';
import { emailTaken, invalidCredentials } from './auth.errors.js';
import { cleanUserAgent } from './device.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password.js';
import { SESSION_DAYS, hashSessionToken, newSessionToken } from './session-token.js';
import type { UserRow } from './user-view.js';

// BACKLOG #34 (kayıt, giriş, çıkış) ve #36/#37 (/me): openapi.yaml auth ve me uçları.
export const REGISTER_LIMIT_PER_HOUR = 10;
export const LOGIN_LIMIT_PER_15_MIN = 10;
const HOUR_MS = 60 * 60 * 1000;
const QUARTER_HOUR_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

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

const LOCALES = { tr: 'TR', en: 'EN' } as const;
const THEMES = { light: 'LIGHT', dark: 'DARK', system: 'SYSTEM' } as const;
const CURRENCIES = ['TRY', 'EUR', 'USD'] as const;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  async register(input: FormInput, clientKey: string, userAgent: unknown = null): Promise<SessionStart> {
    if (!this.limiter.allow(`register:${clientKey}`, REGISTER_LIMIT_PER_HOUR, HOUR_MS)) {
      throw rateLimited();
    }

    const form = new FormReader(input);
    const email = form.email('email').toLowerCase();
    const firstName = form.required('firstName', 80);
    const lastName = form.required('lastName', 80);
    const password = this.readPassword(input.password, form, true);
    form.consent();
    form.assertValid('Registration data is invalid');

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

  async login(input: FormInput, clientKey: string, userAgent: unknown = null): Promise<SessionStart> {
    const form = new FormReader(input);
    const email = form.email('email').toLowerCase();
    const password = this.readPassword(input.password, form, false);
    form.assertValid('Login data is invalid');

    // Hem istemci hem hesap başına sınır: biri tek adresten çok hesabı, çok adresten tek hesabı denemesin.
    if (
      !this.limiter.allow(`login:${clientKey}`, LOGIN_LIMIT_PER_15_MIN, QUARTER_HOUR_MS) ||
      !this.limiter.allow(`login-email:${email}`, LOGIN_LIMIT_PER_15_MIN, QUARTER_HOUR_MS)
    ) {
      throw rateLimited();
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
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
  async updateProfile(userId: string, input: FormInput): Promise<UserRow> {
    const errors: Record<string, string> = {};
    const data: {
      firstName?: string;
      lastName?: string;
      locale?: 'TR' | 'EN';
      theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
      currency?: 'TRY' | 'EUR' | 'USD';
      notifyReminders?: boolean;
      notifyCampaigns?: boolean;
    } = {};

    for (const name of ['firstName', 'lastName'] as const) {
      const raw = input[name];
      if (raw === undefined) continue;
      if (typeof raw !== 'string') {
        errors[name] = 'INVALID_FORMAT';
        continue;
      }
      const value = raw.trim();
      if (value === '') errors[name] = 'REQUIRED';
      else if (value.length > 80) errors[name] = 'TOO_LONG';
      else data[name] = value;
    }

    if (input.locale !== undefined) {
      const locale = typeof input.locale === 'string' ? LOCALES[input.locale as keyof typeof LOCALES] : undefined;
      if (locale) data.locale = locale;
      else errors.locale = 'INVALID_FORMAT';
    }
    if (input.theme !== undefined) {
      const theme = typeof input.theme === 'string' ? THEMES[input.theme as keyof typeof THEMES] : undefined;
      if (theme) data.theme = theme;
      else errors.theme = 'INVALID_FORMAT';
    }
    if (input.currency !== undefined) {
      const currency = CURRENCIES.find((candidate) => candidate === input.currency);
      if (currency) data.currency = currency;
      else errors.currency = 'INVALID_FORMAT';
    }

    // E-posta tercihleri: { notifications: { reminders?: boolean, campaigns?: boolean } }, gönderilen alan güncellenir.
    if (input.notifications !== undefined) {
      const raw = input.notifications;
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        errors.notifications = 'INVALID_FORMAT';
      } else {
        const { reminders, campaigns } = raw as Record<string, unknown>;
        if (reminders !== undefined && typeof reminders !== 'boolean') errors.notifications = 'INVALID_FORMAT';
        else if (campaigns !== undefined && typeof campaigns !== 'boolean') errors.notifications = 'INVALID_FORMAT';
        else {
          if (reminders !== undefined) data.notifyReminders = reminders;
          if (campaigns !== undefined) data.notifyCampaigns = campaigns;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw validationFailed(errors, 'Profile data is invalid');
    }
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  // DELETE /me: hesap kalıcı silinir. Oturumlar ve puanlar birlikte gider (cascade);
  // rezervasyon kayıtları kalır, kullanıcı bağlantısı boşalır (anonim). Teklif talepleri de öyle.
  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }

  private readPassword(raw: unknown, form: FormReader, checkLength: boolean): string {
    if (raw === undefined || raw === null || raw === '') {
      form.errors.password = 'REQUIRED';
      return '';
    }
    if (typeof raw !== 'string') {
      form.errors.password = 'INVALID_FORMAT';
      return '';
    }
    if (checkLength) {
      if (raw.length < PASSWORD_MIN) form.errors.password = 'TOO_SHORT';
      else if (raw.length > PASSWORD_MAX) form.errors.password = 'TOO_LONG';
    } else if (raw.length > PASSWORD_MAX) {
      // Çok uzun girdiyle sunucuyu yormayı engeller; hangi kuralın bozulduğunu söylemek gerekmez.
      form.errors.password = 'TOO_LONG';
    }
    return raw;
  }
}