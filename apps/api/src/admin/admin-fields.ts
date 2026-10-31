import { field } from '../common/zod-fields.js';

// The building blocks of the input of the `/admin/*` write endpoints (V2-27, V2-29), written once: a check that says why it
// failed with one of the fixed codes of ADR-17, and the two ways to use it. A new record needs every field; a change
// names only what it changes, and always the version it was made against.
export type Check<T> = (raw: unknown) => { value: T } | { code: string };

// A field of a new record: it has to be there.
export const required = <T>(check: Check<T>) => field<T>(check);

// A field of a change: when it is not sent (`undefined`) the record keeps what it has; when it is, the same check applies.
export const sent = <T>(check: Check<T>) => field<T | undefined>((raw) => (raw === undefined ? { value: undefined } : check(raw)));

// Text, trimmed: missing or empty is REQUIRED, not text INVALID_FORMAT, too long TOO_LONG.
export const text =
  (max: number): Check<string> =>
  (raw) => {
    if (raw === undefined || raw === null) return { code: 'REQUIRED' };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    const value = raw.trim();
    if (value === '') return { code: 'REQUIRED' };
    return value.length > max ? { code: 'TOO_LONG' } : { value };
  };

// The version a change is made against (`updatedAt` of the record it started from), as an ISO date-time.
export const versionField = () =>
  field<Date>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    const date = typeof raw === 'string' ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? { value: date } : { code: 'INVALID_FORMAT' };
  });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// An e-mail address, trimmed and lower case; `INVALID_EMAIL` when it is not one.
export const email: Check<string> = (raw) => {
  const result = text(120)(raw);
  if ('code' in result) return result;
  return EMAIL.test(result.value) ? { value: result.value.toLowerCase() } : { code: 'INVALID_EMAIL' };
};

const PHONE = /^[0-9+()\-.\s]+$/;
// A phone number: digits and the usual signs, at least seven digits.
export const phone: Check<string> = (raw) => {
  const result = text(30)(raw);
  if ('code' in result) return result;
  return PHONE.test(result.value) && result.value.replace(/\D/g, '').length >= 7 ? { value: result.value } : { code: 'INVALID_FORMAT' };
};
