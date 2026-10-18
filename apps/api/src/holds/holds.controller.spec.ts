import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { HoldsController } from './holds.controller.js';
import { HoldsService } from './holds.service.js';

// HTTP-level check of DELETE /holds/{id}: status code, empty body and which client key reaches the service.
const HOLD_ID = '55555555-5555-4555-8555-555555555555';

describe('DELETE /holds/{id}', () => {
  let app: INestApplication;
  let base = '';
  const release = jest.fn(async () => undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HoldsController],
      providers: [{ provide: HoldsService, useValue: { release, create: jest.fn() } }],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, {});
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    release.mockClear();
  });

  it('answers 204 with no body and hands the id and the client key to the service', async () => {
    const response = await fetch(`${base}/holds/${HOLD_ID}`, { method: 'DELETE' });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(release).toHaveBeenCalledTimes(1);
    const [id, key] = release.mock.calls[0] as unknown as [string, string];
    expect(id).toBe(HOLD_ID);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it('uses the same client key on every call from the same address, so a visitor can release their own hold', async () => {
    await fetch(`${base}/holds/${HOLD_ID}`, { method: 'DELETE' });
    await fetch(`${base}/holds/${HOLD_ID}`, { method: 'DELETE' });
    const keys = (release.mock.calls as unknown as Array<[string, string]>).map(([, key]) => key);
    expect(keys[0]).toBe(keys[1]);
  });
});
