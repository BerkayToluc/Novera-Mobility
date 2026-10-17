import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from './auth.module.js';
import { hashPassword, verifyPassword } from './password.js';
import { PasswordResetFake } from './password-reset.testing.js';
import { ResetLinkNotifier } from './reset-link-notifier.js';

// Over real HTTP: status codes, empty bodies and the full forgot -> reset -> login chain.
const fake = new PasswordResetFake();
const sent: string[] = [];

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

describe('password reset over HTTP', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule] })
      .overrideProvider(ResetLinkNotifier)
      .useValue({ send: async (_email: string, link: string) => void sent.push(link) })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    fake.users = [
      { id: 'u1', email: 'ayse@example.com', passwordHash: await hashPassword('old-password-1'), locale: 'TR' },
    ];
    fake.sessions = [];
    fake.resetTokens = [];
    sent.length = 0;
  });

  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.1.0.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify(body),
    });

  it('forgot-password answers 202 with no body for a known and an unknown address alike', async () => {
    const known = await post('/auth/forgot-password', { email: 'ayse@example.com' });
    const unknown = await post('/auth/forgot-password', { email: 'nobody@example.com' });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.text()).toBe(await unknown.text());
    expect(sent).toHaveLength(1);
  });

  it('forgot-password with a bad e-mail is 422 VALIDATION_FAILED', async () => {
    const response = await post('/auth/forgot-password', { email: 'nope' });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: { email: 'INVALID_EMAIL' } });
  });

  it('the whole chain: link, new password 204, old password no longer works, link is spent', async () => {
    await post('/auth/forgot-password', { email: 'ayse@example.com' });
    const token = new URL(sent[0]!).searchParams.get('token')!;

    const done = await post('/auth/reset-password', { token, password: 'brand-new-pass-3' });
    expect(done.status).toBe(204);
    expect(await done.text()).toBe('');
    expect(await verifyPassword('brand-new-pass-3', fake.users[0]!.passwordHash)).toBe(true);

    const again = await post('/auth/reset-password', { token, password: 'another-pass-4' });
    expect(again.status).toBe(422);
    expect(await again.json()).toMatchObject({ code: 'RESET_TOKEN_INVALID' });
  });
});