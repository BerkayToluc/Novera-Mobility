import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from './auth.module.js';
import { FakePrisma } from './auth.testing.js';

// HTTP düzeyinde deneme: gerçek Nest uygulaması, çerez ve korumalı uçlar (veritabanı bellekte taklit).
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const VALID = { email: 'ayse@example.com', password: 'guclu-parola-1', firstName: 'Ayşe', lastName: 'Yılmaz', consent: true };

describe('auth HTTP akışı (çerez + korumalı uçlar)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule] }).compile();
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

  const send = (path: string, init: RequestInit & { cookie?: string } = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        'X-Forwarded-For': `10.0.0.${Math.floor(Math.random() * 250)}`,
      },
    });
  const cookieOf = (response: Response): string => (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

  it('kayıt oturum çerezini httpOnly olarak set eder ve parola özetini döndürmez', async () => {
    const response = await send('/auth/register', { method: 'POST', body: JSON.stringify(VALID) });
    expect(response.status).toBe(201);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/^novera_session=[A-Za-z0-9_-]{40,}/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//);
    const body = await response.json();
    expect(body).toMatchObject({ email: VALID.email, accountType: 'INDIVIDUAL', locale: 'tr' });
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|scrypt/);
  });

  it('GET /me çerezle 200, çerezsiz ve uydurma çerezle 401 UNAUTHENTICATED', async () => {
    const registered = await send('/auth/register', { method: 'POST', body: JSON.stringify(VALID) });
    const cookie = cookieOf(registered);
    expect((await send('/me', { cookie })).status).toBe(200);
    const anonymous = await send('/me');
    expect(anonymous.status).toBe(401);
    expect((await anonymous.json()).code).toBe('UNAUTHENTICATED');
    expect((await send('/me', { cookie: 'novera_session=uydurma' })).status).toBe(401);
  });

  it('giriş 200 döner, çıkış 204 döner ve oturumu gerçekten bitirir', async () => {
    await send('/auth/register', { method: 'POST', body: JSON.stringify(VALID) });
    const login = await send('/auth/login', { method: 'POST', body: JSON.stringify({ email: VALID.email, password: VALID.password }) });
    expect(login.status).toBe(200);
    const cookie = cookieOf(login);
    expect((await send('/me', { cookie })).status).toBe(200);
    const logout = await send('/auth/logout', { method: 'POST', cookie });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie') ?? '').toMatch(/novera_session=;/);
    expect((await send('/me', { cookie })).status).toBe(401); // eski çerez artık geçmez
  });

  it('yanlış parola 401 INVALID_CREDENTIALS, çerez set etmez', async () => {
    await send('/auth/register', { method: 'POST', body: JSON.stringify(VALID) });
    const response = await send('/auth/login', { method: 'POST', body: JSON.stringify({ email: VALID.email, password: 'yanlis-parola' }) });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('INVALID_CREDENTIALS');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('PATCH /me tercihleri günceller; geçersiz değer 422', async () => {
    const cookie = cookieOf(await send('/auth/register', { method: 'POST', body: JSON.stringify(VALID) }));
    const ok = await send('/me', { method: 'PATCH', cookie, body: JSON.stringify({ theme: 'dark', currency: 'USD' }) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ theme: 'dark', currency: 'USD' });
    const bad = await send('/me', { method: 'PATCH', cookie, body: JSON.stringify({ theme: 'mor' }) });
    expect(bad.status).toBe(422);
    expect((await bad.json()).fieldErrors).toEqual({ theme: 'INVALID_FORMAT' });
    expect((await send('/me', { method: 'PATCH', body: JSON.stringify({ theme: 'dark' }) })).status).toBe(401);
  });

  it('DELETE /me 204 döner, hesap ve oturum gider', async () => {
    const cookie = cookieOf(await send('/auth/register', { method: 'POST', body: JSON.stringify(VALID) }));
    expect((await send('/me', { method: 'DELETE', cookie })).status).toBe(204);
    expect((await send('/me', { cookie })).status).toBe(401);
    const login = await send('/auth/login', { method: 'POST', body: JSON.stringify({ email: VALID.email, password: VALID.password }) });
    expect(login.status).toBe(401);
  });

  it('bozuk JSON gövdesi sunucuyu çökertmez (400)', async () => {
    const response = await send('/auth/login', { method: 'POST', body: '{bozuk' });
    expect(response.status).toBe(400);
  });
});