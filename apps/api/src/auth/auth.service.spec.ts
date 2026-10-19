import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RateLimiter } from '../forms/rate-limiter.js';
import { AuthService, LOGIN_LIMIT_PER_15_MIN, REGISTER_LIMIT_PER_HOUR } from './auth.service.js';
import { FakePrisma } from './auth.testing.js';
import { hashSessionToken } from './session-token.js';
import { toUserResponse } from './user-view.js';

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu ama hata atılmadı');
}
type ErrorBody = { code: string; fieldErrors?: Record<string, string> };
const bodyOf = (error: HttpException): ErrorBody => error.getResponse() as ErrorBody;

const VALID = {
  email: 'Ayse@Example.com',
  password: 'guclu-parola-1',
  firstName: 'Ayşe',
  lastName: 'Yılmaz',
  consent: true,
};

describe('AuthService', () => {
  let db: FakePrisma;
  let auth: AuthService;

  beforeEach(() => {
    db = new FakePrisma();
    auth = new AuthService(db as unknown as PrismaService, new RateLimiter());
  });

  describe('register', () => {
    it('hesap açar, e-postayı küçük harfe çevirir ve oturum başlatır', async () => {
      const session = await auth.register(VALID, 'c1');
      expect(session.user.email).toBe('ayse@example.com');
      expect(session.user.passwordHash).not.toContain('guclu-parola-1');
      expect(db.sessions).toHaveLength(1);
      expect(db.sessions[0]?.tokenHash).toBe(hashSessionToken(session.token));
      expect(db.sessions[0]?.tokenHash).not.toBe(session.token);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
    });

    it('yanıtta parola özeti olmaz ve enum küçük harf döner', async () => {
      const { user } = await auth.register(VALID, 'c1');
      const view = toUserResponse(user);
      expect(JSON.stringify(view)).not.toContain('passwordHash');
      expect(view).toMatchObject({ accountType: 'INDIVIDUAL', locale: 'tr', theme: 'light', currency: 'TRY', salesContact: null });
    });

    it('aynı e-posta (büyük/küçük harf farkıyla bile) 409 EMAIL_TAKEN', async () => {
      await auth.register(VALID, 'c1');
      const error = await catchHttp(auth.register({ ...VALID, email: 'AYSE@example.com' }, 'c1'));
      expect(error.getStatus()).toBe(409);
      expect(bodyOf(error)).toMatchObject({ code: 'EMAIL_TAKEN', fieldErrors: { email: 'EMAIL_TAKEN' } });
    });

    it('alan hatalarını sabit kodlarla döner (422)', async () => {
      const error = await catchHttp(
        auth.register({ email: 'x', password: '123', firstName: '', consent: false }, 'c1'),
      );
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({
        email: 'INVALID_EMAIL',
        password: 'TOO_SHORT',
        firstName: 'REQUIRED',
        lastName: 'REQUIRED',
        consent: 'CONSENT_REQUIRED',
      });
      expect(db.users).toHaveLength(0);
    });

    it('çok uzun parolayı reddeder, parola metin değilse INVALID_FORMAT', async () => {
      const long = await catchHttp(auth.register({ ...VALID, password: 'a'.repeat(129) }, 'c1'));
      expect(bodyOf(long).fieldErrors?.password).toBe('TOO_LONG');
      const typed = await catchHttp(auth.register({ ...VALID, password: 12345678 }, 'c1'));
      expect(bodyOf(typed).fieldErrors?.password).toBe('INVALID_FORMAT');
    });

    it('parolanın başındaki/sonundaki boşluk korunur', async () => {
      await auth.register({ ...VALID, password: '  boşluklu parola  ' }, 'c1');
      const session = await auth.login({ email: VALID.email, password: '  boşluklu parola  ' }, 'c1');
      expect(session.user.email).toBe('ayse@example.com');
      const error = await catchHttp(auth.login({ email: VALID.email, password: 'boşluklu parola' }, 'c1'));
      expect(bodyOf(error).code).toBe('INVALID_CREDENTIALS');
    });

    it('aynı istemciden saatte en fazla 10 kayıt, sonrası 429', async () => {
      for (let i = 0; i < REGISTER_LIMIT_PER_HOUR; i++) {
        await auth.register({ ...VALID, email: `kisi${i}@example.com` }, 'c-spam');
      }
      const error = await catchHttp(auth.register({ ...VALID, email: 'son@example.com' }, 'c-spam'));
      expect(error.getStatus()).toBe(429);
      expect(bodyOf(error).code).toBe('RATE_LIMITED');
      // başka istemci etkilenmez
      await expect(auth.register({ ...VALID, email: 'baska@example.com' }, 'c-other')).resolves.toBeDefined();
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await auth.register(VALID, 'c0');
      db.sessions = [];
    });

    it('doğru bilgiyle yeni oturum açar (e-posta büyük/küçük harfe duyarsız)', async () => {
      const session = await auth.login({ email: 'AYSE@EXAMPLE.COM', password: VALID.password }, 'c1');
      expect(session.user.firstName).toBe('Ayşe');
      expect(db.sessions).toHaveLength(1);
    });

    it('yanlış parola ve olmayan e-posta aynı 401 INVALID_CREDENTIALS', async () => {
      const wrong = await catchHttp(auth.login({ email: VALID.email, password: 'yanlis-parola' }, 'c1'));
      const missing = await catchHttp(auth.login({ email: 'yok@example.com', password: 'yanlis-parola' }, 'c1'));
      expect(wrong.getStatus()).toBe(401);
      expect(bodyOf(wrong)).toEqual(bodyOf(missing));
      expect(bodyOf(wrong).code).toBe('INVALID_CREDENTIALS');
      expect(db.sessions).toHaveLength(0);
    });

    it('eksik alanlar 422 VALIDATION_FAILED', async () => {
      const error = await catchHttp(auth.login({}, 'c1'));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({ email: 'REQUIRED', password: 'REQUIRED' });
    });

    it('süresi dolmuş eski oturumları temizler', async () => {
      const user = db.users[0]!;
      db.sessions.push({ id: 'old', tokenHash: 'eski', userId: user.id, expiresAt: new Date(Date.now() - 1000) });
      await auth.login({ email: VALID.email, password: VALID.password }, 'c1');
      expect(db.sessions.map((s) => s.id)).not.toContain('old');
      expect(db.sessions).toHaveLength(1);
    });

    it('aynı hesaba 15 dakikada en fazla 10 deneme, sonrası 429 (farklı istemciden de)', async () => {
      for (let i = 0; i < LOGIN_LIMIT_PER_15_MIN; i++) {
        await catchHttp(auth.login({ email: VALID.email, password: 'yanlis-parola' }, `c-${i}`));
      }
      const error = await catchHttp(auth.login({ email: VALID.email, password: VALID.password }, 'c-yeni'));
      expect(error.getStatus()).toBe(429);
    });
  });

  describe('authenticate ve logout', () => {
    it('geçerli anahtar kullanıcıyı verir, bilinmeyen anahtar null', async () => {
      const { token, user } = await auth.register(VALID, 'c1');
      expect((await auth.authenticate(token))?.id).toBe(user.id);
      expect(await auth.authenticate('uydurma')).toBeNull();
    });

    it('süresi dolmuş oturum null döner ve silinir', async () => {
      const { token } = await auth.register(VALID, 'c1');
      db.sessions[0]!.expiresAt = new Date(Date.now() - 1000);
      expect(await auth.authenticate(token)).toBeNull();
      expect(db.sessions).toHaveLength(0);
    });

    it('çıkış oturumu siler; aynı anahtar artık geçmez', async () => {
      const { token } = await auth.register(VALID, 'c1');
      await auth.logout(token);
      expect(await auth.authenticate(token)).toBeNull();
      await expect(auth.logout(null)).resolves.toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    it('yalnızca gönderilen alanları günceller ve e-postayı yok sayar', async () => {
      const { user } = await auth.register(VALID, 'c1');
      const updated = await auth.updateProfile(user.id, {
        firstName: '  Zeynep ',
        locale: 'en',
        theme: 'dark',
        currency: 'EUR',
        email: 'baska@example.com',
      });
      expect(updated).toMatchObject({ firstName: 'Zeynep', lastName: 'Yılmaz', locale: 'EN', theme: 'DARK', currency: 'EUR', email: 'ayse@example.com' });
    });

    it('geçersiz değerleri INVALID_FORMAT / REQUIRED / TOO_LONG ile reddeder', async () => {
      const { user } = await auth.register(VALID, 'c1');
      const error = await catchHttp(
        auth.updateProfile(user.id, { firstName: '  ', lastName: 'x'.repeat(81), locale: 'de', theme: 'mor', currency: 'GBP' }),
      );
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({
        firstName: 'REQUIRED',
        lastName: 'TOO_LONG',
        locale: 'INVALID_FORMAT',
        theme: 'INVALID_FORMAT',
        currency: 'INVALID_FORMAT',
      });
    });

    it('boş gövde kullanıcıyı değiştirmeden döner', async () => {
      const { user } = await auth.register(VALID, 'c1');
      const same = await auth.updateProfile(user.id, {});
      expect(same.firstName).toBe('Ayşe');
    });
  });

  it('hesap silinince kullanıcı ve oturumları gider', async () => {
    const { user, token } = await auth.register(VALID, 'c1');
    await auth.deleteAccount(user.id);
    expect(db.users).toHaveLength(0);
    expect(await auth.authenticate(token)).toBeNull();
  });
});

describe('toUserResponse satış iletişimi', () => {
  const base = {
    id: 'u1', email: 'a@b.co', passwordHash: 'x', firstName: 'A', lastName: 'B',
    accountType: 'CORPORATE' as const, companyName: 'Firma', taxOffice: null, companyCity: null,
    companyPhone: null, contactTitle: null, locale: 'TR' as const, theme: 'LIGHT' as const, currency: 'TRY' as const,
    googleSub: null, notifyReminders: true, notifyCampaigns: false,
  };

  it('JSON alanı tam ise satış iletişimini döner', () => {
    const view = toUserResponse({ ...base, salesContact: { name: 'Selin', email: 's@n.co', phone: '+90 212' } });
    expect(view.salesContact).toEqual({ name: 'Selin', email: 's@n.co', phone: '+90 212' });
  });

  it('boş, eksik ya da bozuk JSON alanında null döner', () => {
    expect(toUserResponse({ ...base, salesContact: null }).salesContact).toBeNull();
    expect(toUserResponse({ ...base, salesContact: { name: 'Selin' } }).salesContact).toBeNull();
    expect(toUserResponse({ ...base, salesContact: 'metin' }).salesContact).toBeNull();
    expect(toUserResponse({ ...base, salesContact: [1] }).salesContact).toBeNull();
  });
});