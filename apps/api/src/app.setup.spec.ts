import 'reflect-metadata';
import { Body, Controller, Get, HttpException, HttpStatus, Post, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { configureApp } from './app.setup.js';
import { clientKeyOf } from './common/client-key.js';

// The behaviour every response of the real server has: error shape, headers and who the client is.
@Controller()
class ProbeController {
  @Get('boom')
  boom(): never {
    throw new Error('connection to db.internal:5432 failed, password=hunter2');
  }

  @Get('coded')
  coded(): never {
    throw new HttpException(
      { code: 'VALIDATION_FAILED', message: 'Nope', fieldErrors: { email: 'INVALID_EMAIL' } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  @Get('plain')
  plain(): never {
    throw new HttpException('Forbidden resource with details', HttpStatus.FORBIDDEN);
  }

  @Get('me/anything')
  mine(): { ok: true } {
    return { ok: true };
  }

  @Get('public')
  open(): { ok: true } {
    return { ok: true };
  }

  @Get('who')
  who(@Req() request: Request): { key: string } {
    return { key: clientKeyOf(request) };
  }

  @Post('echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

async function start(env: NodeJS.ProcessEnv = {}): Promise<{ app: INestApplication; base: string }> {
  const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, env);
  await app.listen(0);
  return { app, base: await app.getUrl() };
}

describe('configureApp', () => {
  let app: INestApplication;
  let base = '';
  beforeAll(async () => ({ app, base } = await start()));
  afterAll(async () => app.close());

  describe('error shape', () => {
    it('hides the details of an unexpected error', async () => {
      const response = await fetch(`${base}/boom`);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
      expect(JSON.stringify(body)).not.toMatch(/hunter2|db\.internal|stack/);
    });

    it('passes a deliberate error through unchanged', async () => {
      const response = await fetch(`${base}/coded`);
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'Nope',
        fieldErrors: { email: 'INVALID_EMAIL' },
      });
    });

    it('turns a framework error into the contract shape without its own text', async () => {
      const plain = await fetch(`${base}/plain`);
      expect(plain.status).toBe(403);
      const plainBody = await plain.json();
      expect(plainBody.code).toBe('BAD_REQUEST');
      expect(plainBody).not.toHaveProperty('statusCode');
      expect(JSON.stringify(plainBody)).not.toContain('details');

      const missing = await fetch(`${base}/no-such-route`);
      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({ code: 'NOT_FOUND', message: 'Not found' });
    });

    it('answers invalid JSON with 400 BAD_REQUEST and none of the parser text', async () => {
      const response = await fetch(`${base}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"broken":',
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: 'BAD_REQUEST', message: 'The request is not valid' });
    });

    it('turns away a body that is not JSON with 415 (a form post, text/plain)', async () => {
      for (const [type, body] of [
        ['application/x-www-form-urlencoded', 'a=1'],
        ['text/plain', '{"a":1}'],
        ['multipart/form-data; boundary=x', '--x--'],
      ] as const) {
        const response = await fetch(`${base}/echo`, { method: 'POST', headers: { 'Content-Type': type }, body });
        expect(response.status).toBe(415);
        expect(await response.json()).toEqual({ code: 'BAD_REQUEST', message: 'This content type is not supported' });
      }
    });

    it('still takes JSON (also with a charset) and a call with no body at all', async () => {
      const json = await fetch(`${base}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: '{"a":1}',
      });
      expect(json.status).toBe(201);
      expect(await json.json()).toEqual({ a: 1 });
      expect((await fetch(`${base}/echo`, { method: 'POST' })).status).toBe(201);
    });

    it('answers a body over the limit with 413 PAYLOAD_TOO_LARGE', async () => {
      const response = await fetch(`${base}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(300_000) }),
      });
      expect(response.status).toBe(413);
      expect((await response.json()).code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('headers', () => {
    it('sets the safe defaults and does not announce the framework', async () => {
      const response = await fetch(`${base}/public`);
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect(response.headers.get('x-powered-by')).toBeNull();
      expect(response.headers.get('cache-control')).toBeNull();
    });

    it('marks answers about one person as not cacheable', async () => {
      expect((await fetch(`${base}/me/anything`)).headers.get('cache-control')).toBe('no-store');
    });

    it('sets the headers on error answers too', async () => {
      expect((await fetch(`${base}/boom`)).headers.get('x-content-type-options')).toBe('nosniff');
    });
  });

  describe('who the client is (one trusted proxy by default)', () => {
    const keyFor = async (forwarded?: string): Promise<string> => {
      const response = await fetch(`${base}/who`, { headers: forwarded ? { 'X-Forwarded-For': forwarded } : {} });
      return ((await response.json()) as { key: string }).key;
    };

    it('believes the entry our proxy added, not what the visitor wrote in front of it', async () => {
      const first = await keyFor('1.1.1.1, 203.0.113.9');
      const second = await keyFor('2.2.2.2, 203.0.113.9');
      const third = await keyFor('2.2.2.2, 203.0.113.10');
      expect(first).toBe(second);
      expect(first).not.toBe(third);
    });

    it('uses the connection itself when there is no header', async () => {
      expect(await keyFor()).toBe(await keyFor());
    });
  });
});

describe('configureApp with TRUST_PROXY_HOPS=0 (API reached directly)', () => {
  it('ignores X-Forwarded-For completely', async () => {
    const { app, base } = await start({ TRUST_PROXY_HOPS: '0' });
    try {
      const keyFor = async (forwarded: string): Promise<string> => {
        const response = await fetch(`${base}/who`, { headers: { 'X-Forwarded-For': forwarded } });
        return ((await response.json()) as { key: string }).key;
      };
      expect(await keyFor('1.1.1.1')).toBe(await keyFor('2.2.2.2'));
    } finally {
      await app.close();
    }
  });

  it('refuses to start with a bad value', async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    const app = moduleRef.createNestApplication();
    expect(() => configureApp(app, { TRUST_PROXY_HOPS: 'many' })).toThrow('TRUST_PROXY_HOPS');
    await app.close();
  });
});
