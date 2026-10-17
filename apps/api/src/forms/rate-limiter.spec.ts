import type { Request } from 'express';
import { MAX_TRACKED_KEYS, RateLimiter, clientKeyOf } from './rate-limiter.js';

const fakeRequest = (ip: string | undefined): Request =>
  ({ ip, socket: { remoteAddress: '::1' }, headers: { 'x-forwarded-for': '6.6.6.6' } }) as unknown as Request;

describe('RateLimiter', () => {
  it('allows up to the limit, refuses the next one and lets the client back in after the window', () => {
    const limiter = new RateLimiter();
    expect(limiter.allow('k', 2, 1000, 0)).toBe(true);
    expect(limiter.allow('k', 2, 1000, 10)).toBe(true);
    expect(limiter.allow('k', 2, 1000, 20)).toBe(false);
    expect(limiter.allow('k', 2, 1000, 1500)).toBe(true);
  });

  it('keeps clients apart', () => {
    const limiter = new RateLimiter();
    expect(limiter.allow('a', 1, 1000, 0)).toBe(true);
    expect(limiter.allow('a', 1, 1000, 1)).toBe(false);
    expect(limiter.allow('b', 1, 1000, 1)).toBe(true);
  });

  it('stays bounded when a flood of different keys arrives, and forgets the least recently used first', () => {
    const limiter = new RateLimiter();
    const size = () => (limiter as unknown as { hits: Map<string, number[]> }).hits.size;
    const now = 1_000_000;
    // A client that is near its limit and keeps being active.
    for (let i = 0; i < 3; i += 1) limiter.allow('busy', 3, 60_000, now);
    for (let i = 0; i < MAX_TRACKED_KEYS + 500; i += 1) {
      limiter.allow(`flood-${i}`, 1, 60_000, now + 1);
      if (i % 1000 === 0) limiter.allow('busy', 3, 60_000, now + 2); // refused, but counts as recent use
    }
    expect(size()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
    // The active client was not pushed out, so it is still limited.
    expect(limiter.allow('busy', 3, 60_000, now + 3)).toBe(false);
  });
});

describe('clientKeyOf', () => {
  it('uses the address Express worked out, not the X-Forwarded-For header', () => {
    expect(clientKeyOf(fakeRequest('1.2.3.4'))).toBe(clientKeyOf(fakeRequest('1.2.3.4')));
    expect(clientKeyOf(fakeRequest('1.2.3.4'))).not.toBe(clientKeyOf(fakeRequest('1.2.3.5')));
    expect(clientKeyOf(fakeRequest('1.2.3.4'))).toMatch(/^[0-9a-f]{32}$/);
  });

  it('falls back to the connection address when Express has none', () => {
    const request = { ip: undefined, socket: { remoteAddress: '9.9.9.9' }, headers: {} } as unknown as Request;
    expect(clientKeyOf(request)).toBe(clientKeyOf(fakeRequest('9.9.9.9')));
  });
});
