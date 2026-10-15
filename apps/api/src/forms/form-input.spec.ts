import { HttpException } from '@nestjs/common';
import { asFormInput, FormReader, isSpam } from './form-input.js';
import { RateLimiter } from './rate-limiter.js';

// Veritabanı gerektirmeyen birim testleri: her ortamda ve CI'da çalışır.

describe('FormReader', () => {
  describe('required (metin)', () => {
    it('eksik alan REQUIRED döner', () => {
      const form = new FormReader({});
      expect(form.required('name', 10)).toBe('');
      expect(form.errors.name).toBe('REQUIRED');
    });

    it('yalnızca boşluktan oluşan metin REQUIRED sayılır', () => {
      const form = new FormReader({ name: '   ' });
      form.required('name', 10);
      expect(form.errors.name).toBe('REQUIRED');
    });

    it('baştaki ve sondaki boşluklar kırpılır', () => {
      const form = new FormReader({ name: '  Ayşe  ' });
      expect(form.required('name', 10)).toBe('Ayşe');
      expect(form.errors).toEqual({});
    });

    it('sınır uzunluğundaki metin kabul edilir, bir fazlası TOO_LONG', () => {
      const ok = new FormReader({ name: 'a'.repeat(10) });
      expect(ok.required('name', 10)).toBe('a'.repeat(10));
      expect(ok.errors).toEqual({});

      const tooLong = new FormReader({ name: 'a'.repeat(11) });
      tooLong.required('name', 10);
      expect(tooLong.errors.name).toBe('TOO_LONG');
    });

    it.each([[123], [true], [['a']], [{ a: 1 }]])('metin olmayan değer INVALID_FORMAT: %p', (value) => {
      const form = new FormReader({ name: value });
      form.required('name', 10);
      expect(form.errors.name).toBe('INVALID_FORMAT');
    });
  });

  describe('optional (metin)', () => {
    it('eksik ya da boş alan null döner ve hata vermez', () => {
      const form = new FormReader({ notes: '  ' });
      expect(form.optional('notes', 10)).toBeNull();
      expect(form.optional('yok', 10)).toBeNull();
      expect(form.errors).toEqual({});
    });

    it('dolu alan uzunsa yine TOO_LONG', () => {
      const form = new FormReader({ notes: 'x'.repeat(11) });
      form.optional('notes', 10);
      expect(form.errors.notes).toBe('TOO_LONG');
    });
  });

  describe('email', () => {
    it.each([['ad@sirket.com'], ['a.b+etiket@alt.sirket.com.tr'], ['  ad@sirket.com  ']])(
      'geçerli adres kabul edilir: %p',
      (value) => {
        const form = new FormReader({ email: value });
        expect(form.email('email')).toBe(value.trim());
        expect(form.errors).toEqual({});
      },
    );

    it.each([['ad'], ['ad@'], ['@sirket.com'], ['ad@sirket'], ['ad @sirket.com'], ['ad@@sirket.com']])(
      'geçersiz adres INVALID_EMAIL: %p',
      (value) => {
        const form = new FormReader({ email: value });
        form.email('email');
        expect(form.errors.email).toBe('INVALID_EMAIL');
      },
    );

    it('eksik adres REQUIRED, çok uzun adres TOO_LONG', () => {
      const missing = new FormReader({});
      missing.email('email');
      expect(missing.errors.email).toBe('REQUIRED');

      const long = new FormReader({ email: `${'a'.repeat(250)}@x.com` });
      long.email('email');
      expect(long.errors.email).toBe('TOO_LONG');
    });
  });

  describe('phone', () => {
    it('eksik ya da boş telefon null döner', () => {
      expect(new FormReader({}).phone('phone')).toBeNull();
      expect(new FormReader({ phone: '' }).phone('phone')).toBeNull();
    });

    it.each([['0532 123 45 67'], ['+90 (532) 123-45-67'], ['0212.555.01.01']])('geçerli telefon: %p', (value) => {
      const form = new FormReader({ phone: value });
      expect(form.phone('phone')).toBe(value);
      expect(form.errors).toEqual({});
    });

    it.each([['abc'], ['0532-<script>'], ['5551234;DROP']])('izin verilmeyen karakter INVALID_FORMAT: %p', (value) => {
      const form = new FormReader({ phone: value });
      form.phone('phone');
      expect(form.errors.phone).toBe('INVALID_FORMAT');
    });

    it('30 karakterden uzun telefon TOO_LONG', () => {
      const form = new FormReader({ phone: '1'.repeat(31) });
      form.phone('phone');
      expect(form.errors.phone).toBe('TOO_LONG');
    });
  });

  describe('integer', () => {
    it('aralık içindeki tam sayı kabul edilir (sınırlar dahil)', () => {
      expect(new FormReader({ n: 1 }).integer('n', 1, 10)).toBe(1);
      expect(new FormReader({ n: 10 }).integer('n', 1, 10)).toBe(10);
    });

    it.each([[0], [11], [-5]])('aralık dışı OUT_OF_RANGE: %p', (value) => {
      const form = new FormReader({ n: value });
      form.integer('n', 1, 10);
      expect(form.errors.n).toBe('OUT_OF_RANGE');
    });

    it.each([['5'], [2.5], [true], [NaN], [Infinity]])('tam sayı olmayan değer INVALID_FORMAT: %p', (value) => {
      const form = new FormReader({ n: value });
      form.integer('n', 1, 10);
      expect(form.errors.n).toBe('INVALID_FORMAT');
    });

    it('eksik değer REQUIRED', () => {
      const form = new FormReader({});
      form.integer('n', 1, 10);
      expect(form.errors.n).toBe('REQUIRED');
    });
  });

  describe('consent', () => {
    it('yalnızca true kabul edilir', () => {
      const ok = new FormReader({ consent: true });
      ok.consent();
      expect(ok.errors).toEqual({});
    });

    it.each([[false], ['true'], [1], [undefined], [null]])('true dışındaki değer CONSENT_REQUIRED: %p', (value) => {
      const form = new FormReader({ consent: value });
      form.consent();
      expect(form.errors.consent).toBe('CONSENT_REQUIRED');
    });
  });

  describe('assertValid', () => {
    it('hata yoksa sessiz geçer', () => {
      expect(() => new FormReader({}).assertValid('x')).not.toThrow();
    });

    it('hata varsa 422 VALIDATION_FAILED ve tüm alan hatalarıyla fırlatır', () => {
      const form = new FormReader({});
      form.required('a', 5);
      form.email('b');
      form.consent();
      let caught: unknown;
      try {
        form.assertValid('Bozuk');
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(HttpException);
      const exception = caught as HttpException;
      expect(exception.getStatus()).toBe(422);
      expect(exception.getResponse()).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'Bozuk',
        fieldErrors: { a: 'REQUIRED', b: 'REQUIRED', consent: 'CONSENT_REQUIRED' },
      });
    });
  });
});

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

describe('asFormInput', () => {
  it('nesneyi olduğu gibi döndürür', () => {
    const body = { a: 1 };
    expect(asFormInput(body)).toBe(body);
  });

  it.each([[null], [undefined], ['metin'], [42], [[1, 2]]])('nesne olmayan gövde boş nesne olur: %p', (body) => {
    expect(asFormInput(body)).toEqual({});
  });
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
