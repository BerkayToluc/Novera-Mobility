import { isSpam } from './form-input.js';
import { RateLimiter } from './rate-limiter.js';

// Veritabanı gerektirmeyen birim testleri: her ortamda ve CI'da çalışır.

describe('isSpam (tuzak alan)', () => {
  it.each([[{}], [{ website: '' }], [{ website: '   ' }], [{ website: null }], [{ website: undefined }]])(
    'boş tuzak alan spam değildir: %p',
    (input) => {
      expect(isSpam(input)).toBe(false);
    },
  );

  it.each([[{ website: 'http://spam.example' }], [{ website: 'x' }], [{ website: 1 }], [{ website: true }], [{ website: {} }]])(
    'dolu tuzak alan spamdır: %p',
    (input) => {
      expect(isSpam(input)).toBe(true);
    },
  );
});

describe('RateLimiter', () => {
  const HOUR = 60 * 60 * 1000;

  it('sınıra kadar izin verir, sonrakini reddeder', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 3; i += 1) expect(limiter.allow('k', 3, HOUR, 1000 + i)).toBe(true);
    expect(limiter.allow('k', 3, HOUR, 2000)).toBe(false);
    expect(limiter.allow('k', 3, HOUR, 3000)).toBe(false);
  });

  it('süre dolunca yeniden izin verir', () => {
    const limiter = new RateLimiter();
    const start = 1_000_000;
    for (let i = 0; i < 3; i += 1) limiter.allow('k', 3, HOUR, start);
    expect(limiter.allow('k', 3, HOUR, start + HOUR - 1)).toBe(false);
    expect(limiter.allow('k', 3, HOUR, start + HOUR + 1)).toBe(true);
  });

  it('reddedilen istekler sayacı uzatmaz (süre ilk izinli istekten işler)', () => {
    const limiter = new RateLimiter();
    const start = 5_000_000;
    limiter.allow('k', 1, HOUR, start);
    for (let i = 1; i <= 10; i += 1) expect(limiter.allow('k', 1, HOUR, start + i * 1000)).toBe(false);
    expect(limiter.allow('k', 1, HOUR, start + HOUR + 1)).toBe(true);
  });

  it('anahtarlar birbirinden bağımsızdır', () => {
    const limiter = new RateLimiter();
    expect(limiter.allow('a', 1, HOUR, 100)).toBe(true);
    expect(limiter.allow('a', 1, HOUR, 200)).toBe(false);
    expect(limiter.allow('b', 1, HOUR, 200)).toBe(true);
  });
});
