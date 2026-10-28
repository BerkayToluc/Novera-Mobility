import 'reflect-metadata';
import { Controller, Get, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { configureApp } from '../app.setup.js';
import { clientKeyOf } from './client-key.js';
import { ACCESS_KEY_HEADER, CLIENT_IP_HEADER, keyMatches } from './api-access.js';

@Controller()
class ProbeController {
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('secret')
  secret(@Req() request: Request): { key: string } {
    return { key: clientKeyOf(request) };
  }
}

const KEY = 'a-long-shared-secret-for-the-tests-0123456789';

async function start(env: NodeJS.ProcessEnv): Promise<{ app: INestApplication; base: string }> {
  const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, env);
  await app.listen(0);
  return { app, base: await app.getUrl() };
}

describe('keyMatches', () => {
  it('accepts only the exact secret', () => {
    expect(keyMatches(KEY, KEY)).toBe(true);
    expect(keyMatches(`${KEY}x`, KEY)).toBe(false);
    expect(keyMatches('', KEY)).toBe(false);
    expect(keyMatches(undefined, KEY)).toBe(false);
    expect(keyMatches(['a', 'b'], KEY)).toBe(false);
  });
});

describe('API access key', () => {
  let app: INestApplication;
  let base = '';
  beforeAll(async () => ({ app, base } = await start({ API_ACCESS_KEY: KEY })));
  afterAll(async () => app.close());

  const keyFor = async (headers: Record<string, string>): Promise<string> => {
    const response = await fetch(`${base}/secret`, { headers: { [ACCESS_KEY_HEADER]: KEY, ...headers } });
    return ((await response.json()) as { key: string }).key;
  };

  it('answers a call without the key, or with a wrong one, as if the route did not exist', async () => {
    const wrongCalls: Array<Record<string, string>> = [
      {},
      { [ACCESS_KEY_HEADER]: 'wrong' },
      { [ACCESS_KEY_HEADER]: `${KEY}x` },
    ];
    for (const headers of wrongCalls) {
      const response = await fetch(`${base}/secret`, { headers });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'NOT_FOUND', message: 'Not found' });
    }
  });

  it('lets the web server in with the key', async () => {
    const response = await fetch(`${base}/secret`, { headers: { [ACCESS_KEY_HEADER]: KEY } });
    expect(response.status).toBe(200);
  });

  it('leaves the health check open, for the host, and it says nothing else', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('believes the visitor address the web server passes along, and tells visitors apart by it', async () => {
    const first = await keyFor({ [CLIENT_IP_HEADER]: '203.0.113.7' });
    expect(await keyFor({ [CLIENT_IP_HEADER]: '203.0.113.7' })).toBe(first);
    expect(await keyFor({ [CLIENT_IP_HEADER]: '203.0.113.8' })).not.toBe(first);
    expect(await keyFor({ [CLIENT_IP_HEADER]: '2001:db8::1' })).not.toBe(first);
  });

  it('ignores an address that is not an address', async () => {
    const own = await keyFor({});
    expect(await keyFor({ [CLIENT_IP_HEADER]: 'not-an-ip' })).toBe(own);
    expect(await keyFor({ [CLIENT_IP_HEADER]: '1.2.3.4, 5.6.7.8' })).toBe(own);
  });

  it('does not believe the address header without the key', async () => {
    const response = await fetch(`${base}/secret`, { headers: { [CLIENT_IP_HEADER]: '203.0.113.7' } });
    expect(response.status).toBe(404);
  });
});

describe('without an access key (development)', () => {
  it('leaves the API open and ignores the address header', async () => {
    const { app, base } = await start({});
    try {
      const get = async (headers: Record<string, string>) =>
        ((await (await fetch(`${base}/secret`, { headers })).json()) as { key: string }).key;
      expect(await get({})).toBe(await get({ [CLIENT_IP_HEADER]: '203.0.113.7' }));
    } finally {
      await app.close();
    }
  });
});
