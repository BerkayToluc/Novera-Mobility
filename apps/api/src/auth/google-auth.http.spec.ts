import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from './auth.module.js';
import { FakePrisma } from './auth.testing.js';
import { GoogleTokenError, GoogleTokenVerifier, type GoogleProfile } from './google-verifier.js';

const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const verifier = {
  isConfigured: () => true,
  verify: async (credential: string): Promise<GoogleProfile> => {
    if (credential !== 'good') throw new GoogleTokenError('bad');
    return { sub: 'g-1', email: 'ayse@example.com', givenName: 'Ayşe', familyName: 'Yılmaz', name: null };
  },
};

describe('POST /auth/google (HTTP)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule] })
      .overrideProvider(GoogleTokenVerifier)
      .useValue(verifier)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    fake.users = [];
    fake.sessions = [];
  });

  const post = (body: unknown) =>
    fetch(`${base}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.1.0.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify(body),
    });

  it('yeni hesap 201, ikinci giriş 200; ikisi de httpOnly çerez verir, GET /me çalışır', async () => {
    const first = await post({ credential: 'good', consent: true });
    expect(first.status).toBe(201);
    expect(first.headers.get('set-cookie')).toMatch(/^novera_session=.+HttpOnly/i);
    expect(await first.json()).toMatchObject({ email: 'ayse@example.com', hasPassword: false, googleLinked: true });

    const second = await post({ credential: 'good' });
    expect(second.status).toBe(200);
    const cookie = (second.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const me = await fetch(`${base}/me`, { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    expect(JSON.stringify(await me.json())).not.toMatch(/passwordHash|googleSub|sub-/);
  });

  it('onaysız yeni hesap 422 ve çerez yok; geçersiz token 401', async () => {
    const noConsent = await post({ credential: 'good' });
    expect(noConsent.status).toBe(422);
    expect(noConsent.headers.get('set-cookie')).toBeNull();
    expect((await noConsent.json()).fieldErrors).toEqual({ consent: 'CONSENT_REQUIRED' });
    const bad = await post({ credential: 'nope', consent: true });
    expect(bad.status).toBe(401);
    expect(bad.headers.get('set-cookie')).toBeNull();
  });
});
