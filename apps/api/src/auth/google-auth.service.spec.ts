import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AccountSecurityService } from './account-security.service.js';
import { AuthService } from './auth.service.js';
import { FakePrisma } from './auth.testing.js';
import { GoogleAuthService, namesFrom } from './google-auth.service.js';
import { GoogleTokenError, GoogleTokenVerifier, type GoogleProfile } from './google-verifier.js';
import { hashPassword } from './password.js';
import { toUserResponse } from './user-view.js';

class FakeVerifier extends GoogleTokenVerifier {
  configured = true;
  profile: GoogleProfile = { sub: 'g-1', email: 'ayse@example.com', givenName: 'Ayşe', familyName: 'Yılmaz', name: 'Ayşe Yılmaz' };
  isConfigured() {
    return this.configured;
  }
  async verify(credential: string): Promise<GoogleProfile> {
    if (credential !== 'good') throw new GoogleTokenError('bad');
    return this.profile;
  }
}

async function failure(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('expected an HttpException');
}
const body = (e: HttpException) => e.getResponse() as Record<string, any>;

describe('GoogleAuthService', () => {
  let db: FakePrisma;
  let verifier: FakeVerifier;
  let service: GoogleAuthService;

  beforeEach(() => {
    db = new FakePrisma();
    verifier = new FakeVerifier();
    service = new GoogleAuthService(db as unknown as PrismaService, verifier);
  });

  it('yeni hesap: onayla açılır, parolasız, oturum başlar', async () => {
    const { session, created } = await service.signIn({ credential: 'good', consent: true });
    expect(created).toBe(true);
    expect(session.user).toMatchObject({ email: 'ayse@example.com', googleSub: 'g-1', passwordHash: null, firstName: 'Ayşe', lastName: 'Yılmaz' });
    expect(db.sessions).toHaveLength(1);
    expect(toUserResponse(session.user)).toMatchObject({ hasPassword: false, googleLinked: true });
  });

  it('yeni hesap onaysız 422 consent CONSENT_REQUIRED ve hesap açılmaz', async () => {
    const error = await failure(service.signIn({ credential: 'good' }));
    expect(error.getStatus()).toBe(422);
    expect(body(error).fieldErrors).toEqual({ consent: 'CONSENT_REQUIRED' });
    expect(db.users).toHaveLength(0);
  });

  it('bilinen Google hesabı onay istemeden giriş yapar (200)', async () => {
    await service.signIn({ credential: 'good', consent: true });
    const { session, created } = await service.signIn({ credential: 'good' });
    expect(created).toBe(false);
    expect(db.users).toHaveLength(1);
    expect(db.sessions).toHaveLength(2);
    expect(session.user.googleSub).toBe('g-1');
  });

  it('parolalı bireysel hesap bağlanır: parola silinir, eski oturumlar kapanır', async () => {
    const auth = new AuthService(db as unknown as PrismaService);
    await auth.register({ email: 'ayse@example.com', password: 'guclu-parola-1', firstName: 'A', lastName: 'B', consent: true });
    await auth.register({ email: 'baska@example.com', password: 'guclu-parola-1', firstName: 'A', lastName: 'B', consent: true });
    expect(db.sessions).toHaveLength(2);

    const { session, created } = await service.signIn({ credential: 'good' });
    expect(created).toBe(false);
    expect(session.user).toMatchObject({ googleSub: 'g-1', passwordHash: null });
    // ayse's old session is gone, only the new one remains for her; the other account keeps its own
    const ayse = db.users.find((u) => u.email === 'ayse@example.com')!;
    expect(db.sessions.filter((s) => s.userId === ayse.id)).toHaveLength(1);
    expect(db.sessions).toHaveLength(2);
    // password sign-in no longer works
    const error = await failure(auth.login({ email: 'ayse@example.com', password: 'guclu-parola-1' }));
    expect(error.getStatus()).toBe(401);
  });

  it('kurumsal hesap reddedilir (403 GOOGLE_NOT_ALLOWED), hiçbir şey değişmez', async () => {
    db.users.push({ id: 'u1', email: 'ayse@example.com', passwordHash: await hashPassword('x'.repeat(10)), googleSub: null, accountType: 'CORPORATE' });
    const error = await failure(service.signIn({ credential: 'good', consent: true }));
    expect(error.getStatus()).toBe(403);
    expect(body(error).code).toBe('GOOGLE_NOT_ALLOWED');
    expect(db.users[0]).toMatchObject({ googleSub: null });
    expect(db.users[0]?.passwordHash).not.toBeNull();
  });

  it('aynı e-postaya başka bir Google hesabı bağlıysa reddedilir', async () => {
    await service.signIn({ credential: 'good', consent: true });
    verifier.profile = { ...verifier.profile, sub: 'g-2' };
    const error = await failure(service.signIn({ credential: 'good', consent: true }));
    expect(body(error).code).toBe('GOOGLE_NOT_ALLOWED');
  });

  it('geçersiz token 401 GOOGLE_TOKEN_INVALID', async () => {
    const error = await failure(service.signIn({ credential: 'bad', consent: true }));
    expect(error.getStatus()).toBe(401);
    expect(body(error).code).toBe('GOOGLE_TOKEN_INVALID');
  });

  it('credential eksikse 422, consent bool değilse 422', async () => {
    expect(body(await failure(service.signIn({}))).fieldErrors).toEqual({ credential: 'REQUIRED' });
    expect(body(await failure(service.signIn({ credential: 'good', consent: 'yes' }))).fieldErrors).toEqual({ consent: 'INVALID_FORMAT' });
  });

  it('ayarlı değilse 503 GOOGLE_SIGNIN_UNAVAILABLE', async () => {
    verifier.configured = false;
    const error = await failure(service.signIn({ credential: 'good', consent: true }));
    expect(error.getStatus()).toBe(503);
    expect(body(error).code).toBe('GOOGLE_SIGNIN_UNAVAILABLE');
  });

  describe('parolasız hesap', () => {
    it('parolayla girişte 401 INVALID_CREDENTIALS (çökmez)', async () => {
      await service.signIn({ credential: 'good', consent: true });
      const auth = new AuthService(db as unknown as PrismaService);
      const error = await failure(auth.login({ email: 'ayse@example.com', password: 'herhangi-parola' }));
      expect(error.getStatus()).toBe(401);
      expect(body(error).code).toBe('INVALID_CREDENTIALS');
    });

    it('parola değiştirme 409 PASSWORD_NOT_SET', async () => {
      const { session } = await service.signIn({ credential: 'good', consent: true });
      const security = new AccountSecurityService(db as unknown as PrismaService);
      const error = await failure(security.changePassword(session.user, null, { currentPassword: 'a', newPassword: 'yeni-parola-1' }));
      expect(error.getStatus()).toBe(409);
      expect(body(error).code).toBe('PASSWORD_NOT_SET');
    });
  });

  describe('namesFrom', () => {
    const base = { sub: 's', email: 'zeynep.kaya@example.com', givenName: null, familyName: null, name: null };
    it('given/family yoksa görünen adı böler', () => {
      expect(namesFrom({ ...base, name: 'Zeynep Ada Kaya' })).toEqual({ firstName: 'Zeynep', lastName: 'Ada Kaya' });
    });
    it('ad yoksa e-postanın başını kullanır, soyadı "-" olur', () => {
      expect(namesFrom(base)).toEqual({ firstName: 'zeynep.kaya', lastName: '-' });
    });
    it('80 karakterden uzun adı keser', () => {
      expect(namesFrom({ ...base, givenName: 'a'.repeat(200) }).firstName).toHaveLength(80);
    });
  });
});
