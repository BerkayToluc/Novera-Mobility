import { HttpException } from '@nestjs/common';
import { z } from 'zod';
import {
  accountEmail,
  consent,
  email,
  integer,
  oneOf,
  optionalFlag,
  optionalOneOf,
  optionalUuid,
  requiredUuid,
  slotDate,
  optionalText,
  password,
  phone,
  requiredText,
} from './zod-fields.js';
import { parseInput, validationFailed, ZodValidationPipe } from './zod-validation.js';

// Veritabanı gerektirmeyen birim testleri: alan kuralları ve hata kodları (ADR-17, ADR-26).

// Runs one field rule on a body that has (or lacks) the field and answers `{ value }` or `{ error }`.
function run(rule: z.ZodType, body: Record<string, unknown>): { value: unknown } | { error: string } {
  try {
    return { value: (parseInput(z.object({ f: rule }), body, 'x') as { f: unknown }).f };
  } catch (error) {
    const response = (error as HttpException).getResponse() as { fieldErrors: Record<string, string> };
    return { error: response.fieldErrors.f! };
  }
}
const value = (rule: z.ZodType, raw: unknown) => run(rule, { f: raw });
const missing = (rule: z.ZodType) => run(rule, {});

describe('requiredText', () => {
  it('eksik alan REQUIRED, yalnızca boşluk REQUIRED', () => {
    expect(missing(requiredText(10))).toEqual({ error: 'REQUIRED' });
    expect(value(requiredText(10), '   ')).toEqual({ error: 'REQUIRED' });
  });
  it('kırpar; sınır uzunluk kabul, bir fazlası TOO_LONG', () => {
    expect(value(requiredText(10), '  Ayşe  ')).toEqual({ value: 'Ayşe' });
    expect(value(requiredText(10), 'a'.repeat(10))).toEqual({ value: 'a'.repeat(10) });
    expect(value(requiredText(10), 'a'.repeat(11))).toEqual({ error: 'TOO_LONG' });
  });
  it.each([[123], [true], [['a']], [{ a: 1 }]])('metin olmayan değer INVALID_FORMAT: %p', (raw) => {
    expect(value(requiredText(10), raw)).toEqual({ error: 'INVALID_FORMAT' });
  });
});

describe('optionalText', () => {
  it('eksik ya da boş alan null döner', () => {
    expect(missing(optionalText(10))).toEqual({ value: null });
    expect(value(optionalText(10), '  ')).toEqual({ value: null });
    expect(value(optionalText(10), null)).toEqual({ value: null });
  });
  it('dolu alan uzunsa TOO_LONG, metin değilse INVALID_FORMAT', () => {
    expect(value(optionalText(10), 'x'.repeat(11))).toEqual({ error: 'TOO_LONG' });
    expect(value(optionalText(10), 5)).toEqual({ error: 'INVALID_FORMAT' });
  });
});

describe('email', () => {
  it.each([['ad@sirket.com'], ['a.b+etiket@alt.sirket.com.tr'], ['  ad@sirket.com  ']])('geçerli adres: %p', (raw) => {
    expect(value(email(), raw)).toEqual({ value: raw.trim() });
  });
  it.each([['ad'], ['ad@'], ['@sirket.com'], ['ad@sirket'], ['ad @sirket.com'], ['ad@@sirket.com']])(
    'geçersiz adres INVALID_EMAIL: %p',
    (raw) => {
      expect(value(email(), raw)).toEqual({ error: 'INVALID_EMAIL' });
    },
  );
  it('eksik adres REQUIRED, çok uzun adres TOO_LONG', () => {
    expect(missing(email())).toEqual({ error: 'REQUIRED' });
    expect(value(email(), `${'a'.repeat(250)}@x.com`)).toEqual({ error: 'TOO_LONG' });
  });
  it('hesap adresi küçük harfe çevrilir', () => {
    expect(value(accountEmail(), ' Ece@Novera.COM ')).toEqual({ value: 'ece@novera.com' });
  });
});

describe('phone', () => {
  it('eksik ya da boş telefon null', () => {
    expect(missing(phone())).toEqual({ value: null });
    expect(value(phone(), '')).toEqual({ value: null });
  });
  it.each([['0532 123 45 67'], ['+90 (532) 123-45-67'], ['0212.555.01.01']])('geçerli telefon: %p', (raw) => {
    expect(value(phone(), raw)).toEqual({ value: raw });
  });
  it.each([['abc'], ['0532-<script>'], ['5551234;DROP']])('izin verilmeyen karakter INVALID_FORMAT: %p', (raw) => {
    expect(value(phone(), raw)).toEqual({ error: 'INVALID_FORMAT' });
  });
  it('30 karakterden uzun telefon TOO_LONG', () => {
    expect(value(phone(), '1'.repeat(31))).toEqual({ error: 'TOO_LONG' });
  });
});

describe('integer', () => {
  it('aralık içindeki tam sayı kabul edilir (sınırlar dahil)', () => {
    expect(value(integer(1, 10), 1)).toEqual({ value: 1 });
    expect(value(integer(1, 10), 10)).toEqual({ value: 10 });
  });
  it.each([[0], [11], [-5]])('aralık dışı OUT_OF_RANGE: %p', (raw) => {
    expect(value(integer(1, 10), raw)).toEqual({ error: 'OUT_OF_RANGE' });
  });
  it.each([['5'], [2.5], [true], [NaN], [Infinity]])('tam sayı olmayan değer INVALID_FORMAT: %p', (raw) => {
    expect(value(integer(1, 10), raw)).toEqual({ error: 'INVALID_FORMAT' });
  });
  it('eksik değer REQUIRED', () => {
    expect(missing(integer(1, 10))).toEqual({ error: 'REQUIRED' });
  });
});

describe('consent', () => {
  it('yalnızca true kabul edilir', () => {
    expect(value(consent(), true)).toEqual({ value: true });
  });
  it.each([[false], ['true'], [1], [undefined], [null]])('true dışındaki değer CONSENT_REQUIRED: %p', (raw) => {
    expect(value(consent(), raw)).toEqual({ error: 'CONSENT_REQUIRED' });
  });
});

describe('password', () => {
  it('yeni parola: 8 ile 128 karakter, kırpılmaz', () => {
    expect(value(password('new'), ' 12345678 ')).toEqual({ value: ' 12345678 ' });
    expect(value(password('new'), '1234567')).toEqual({ error: 'TOO_SHORT' });
    expect(value(password('new'), 'a'.repeat(129))).toEqual({ error: 'TOO_LONG' });
  });
  it('girilen parola: kısalık sorulmaz, aşırı uzunluk TOO_LONG', () => {
    expect(value(password('presented'), 'x')).toEqual({ value: 'x' });
    expect(value(password('presented'), 'a'.repeat(129))).toEqual({ error: 'TOO_LONG' });
  });
  it('eksik ya da boş REQUIRED, metin değilse INVALID_FORMAT', () => {
    expect(missing(password('new'))).toEqual({ error: 'REQUIRED' });
    expect(value(password('new'), '')).toEqual({ error: 'REQUIRED' });
    expect(value(password('new'), { a: 1 })).toEqual({ error: 'INVALID_FORMAT' });
  });
});

describe('uuid, oneOf, optionalFlag', () => {
  const id = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';
  it('uuid: geçerli kabul, eksik REQUIRED ya da null, bozuk INVALID_FORMAT', () => {
    expect(value(requiredUuid(), id)).toEqual({ value: id });
    expect(missing(requiredUuid())).toEqual({ error: 'REQUIRED' });
    expect(missing(optionalUuid())).toEqual({ value: null });
    expect(value(requiredUuid(), 'not-an-id')).toEqual({ error: 'INVALID_FORMAT' });
    expect(value(requiredUuid(), 7)).toEqual({ error: 'INVALID_FORMAT' });
  });
  it('oneOf: listedeki değer kabul, başkası INVALID_FORMAT', () => {
    expect(value(oneOf(['A', 'B']), 'A')).toEqual({ value: 'A' });
    expect(value(oneOf(['A', 'B']), 'C')).toEqual({ error: 'INVALID_FORMAT' });
    expect(value(oneOf(['A', 'B']), {})).toEqual({ error: 'INVALID_FORMAT' });
    expect(missing(oneOf(['A', 'B']))).toEqual({ error: 'REQUIRED' });
    expect(missing(optionalOneOf(['A', 'B']))).toEqual({ value: null });
  });
  it('optionalFlag: eksik null, boolean kabul, başkası INVALID_FORMAT', () => {
    expect(missing(optionalFlag())).toEqual({ value: null });
    expect(value(optionalFlag(), false)).toEqual({ value: false });
    expect(value(optionalFlag(), 'yes')).toEqual({ error: 'INVALID_FORMAT' });
  });
});

describe('slotDate', () => {
  it('yarım saatlik dilim kabul edilir', () => {
    expect(value(slotDate(), '2031-01-01T10:30:00.000Z')).toEqual({ value: new Date('2031-01-01T10:30:00.000Z') });
  });
  it('dilim dışı NOT_IN_SLOT, tarih olmayan INVALID_FORMAT, eksik REQUIRED', () => {
    expect(value(slotDate(), '2031-01-01T10:15:00.000Z')).toEqual({ error: 'NOT_IN_SLOT' });
    expect(value(slotDate(), '2031-01-01T10:30:10.000Z')).toEqual({ error: 'NOT_IN_SLOT' });
    expect(value(slotDate(), 'yarın')).toEqual({ error: 'INVALID_FORMAT' });
    expect(value(slotDate(), 12)).toEqual({ error: 'INVALID_FORMAT' });
    expect(missing(slotDate())).toEqual({ error: 'REQUIRED' });
  });
});

describe('parseInput', () => {
  const schema = z.object({ a: requiredText(5), b: email(), consent: consent() });

  it('tüm alan hatalarıyla 422 VALIDATION_FAILED fırlatır', () => {
    let caught: unknown;
    try {
      parseInput(schema, {}, 'Bozuk');
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

  it.each([[null], [undefined], ['metin'], [42], [[1, 2]]])('nesne olmayan gövde boş nesne sayılır: %p', (body) => {
    expect(() => parseInput(schema, body, 'x')).toThrow(HttpException);
    try {
      parseInput(schema, body, 'x');
    } catch (error) {
      expect((error as HttpException).getResponse()).toMatchObject({ fieldErrors: { a: 'REQUIRED' } });
    }
  });

  it('bilinmeyen alanları atar (kimlik, rol gibi alanlar asla okunmaz)', () => {
    const parsed = parseInput(schema, { a: 'x', b: 'a@b.co', consent: true, role: 'ADMIN', userId: 'u1' }, 'x');
    expect(parsed).toEqual({ a: 'x', b: 'a@b.co', consent: true });
  });

  it('zod kütüphanesinin kendi mesajı istemciye sızmaz: INVALID_FORMAT olur', () => {
    const plain = z.object({ n: z.number() });
    expect(() => parseInput(plain, { n: 'x' }, 'x')).toThrow(HttpException);
    try {
      parseInput(plain, { n: 'x' }, 'x');
    } catch (error) {
      expect((error as HttpException).getResponse()).toMatchObject({ fieldErrors: { n: 'INVALID_FORMAT' } });
    }
  });

  it('pipe aynı kuralı uygular', () => {
    const pipe = new ZodValidationPipe(schema, 'Bozuk');
    expect(() => pipe.transform({}, { type: 'body' })).toThrow(HttpException);
    expect(pipe.transform({ a: 'x', b: 'a@b.co', consent: true }, { type: 'body' })).toEqual({
      a: 'x',
      b: 'a@b.co',
      consent: true,
    });
  });

  it('validationFailed ADR-17 biçimindedir', () => {
    expect(validationFailed({ a: 'REQUIRED' }, 'm').getResponse()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'm',
      fieldErrors: { a: 'REQUIRED' },
    });
  });
});
