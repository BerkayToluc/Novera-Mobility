import { RateLimitedException, type RateLimitSpec } from './rate-limit.js';
import { RateLimitService } from './rate-limit.service.js';
import { MemoryRateLimitStore } from './rate-limit.testing.js';

// The counting rule, with the clock fixed (ADR-27): no database, no waiting.
describe('RateLimitService', () => {
  const spec: RateLimitSpec = { bucket: 'test', limit: 3, windowSec: 600 };
  let store: MemoryRateLimitStore;
  let limits: RateLimitService;
  // A moment on a window edge: 10:00:00 UTC, with windows of ten minutes.
  const at = (seconds: number) => new Date(Date.UTC(2031, 0, 1, 10, 0, 0) + seconds * 1000);

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    limits = new RateLimitService(store);
  });

  async function refusal(key: string, now: Date): Promise<RateLimitedException | null> {
    try {
      await limits.consume(spec, key, now);
      return null;
    } catch (error) {
      if (error instanceof RateLimitedException) return error;
      throw error;
    }
  }

  it('lets the requests up to the limit through and refuses the next with 429 RATE_LIMITED', async () => {
    for (let i = 0; i < 3; i += 1) expect(await refusal('ip:a', at(i))).toBeNull();
    const refused = await refusal('ip:a', at(3));
    expect(refused?.getStatus()).toBe(429);
    expect(refused?.getResponse()).toEqual({ code: 'RATE_LIMITED', message: 'Too many requests, try again later' });
  });

  it('says how long to wait: the seconds left in the window', async () => {
    for (let i = 0; i < 3; i += 1) await refusal('ip:a', at(0));
    expect((await refusal('ip:a', at(100)))?.retryAfterSeconds).toBe(500);
    expect((await refusal('ip:a', at(599)))?.retryAfterSeconds).toBe(1);
  });

  it('starts again in the next window', async () => {
    for (let i = 0; i < 4; i += 1) await refusal('ip:a', at(10));
    expect(await refusal('ip:a', at(600))).toBeNull();
  });

  it('counts every key and every bucket on its own', async () => {
    for (let i = 0; i < 4; i += 1) await refusal('ip:a', at(0));
    expect(await refusal('ip:b', at(0))).toBeNull();
    await expect(limits.consume({ ...spec, bucket: 'other' }, 'ip:a', at(0))).resolves.toBeUndefined();
  });

  it('keeps counting refused requests, so a client that keeps trying stays refused for the whole window', async () => {
    for (let i = 0; i < 10; i += 1) await refusal('ip:a', at(i));
    expect(await refusal('ip:a', at(599))).not.toBeNull();
  });

  it('deletes the windows that started before a given moment', async () => {
    await limits.consume(spec, 'ip:a', at(0));
    await limits.consume(spec, 'ip:a', at(600));
    expect(await store.deleteBefore(at(600))).toBe(1);
    expect(store.counts.size).toBe(1);
  });
});
