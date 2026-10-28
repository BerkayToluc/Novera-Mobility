import { z } from 'zod';

// The field rules every endpoint shares (ADR-26). A rule that fails says why with one of the fixed machine
// codes of ADR-17 (REQUIRED, INVALID_FORMAT, TOO_LONG ...) as the issue message; zod-validation.ts turns
// those into `fieldErrors`. Each helper takes `unknown`, so a number or an object where text is expected
// is an INVALID_FORMAT answer and never an exception.

type Check<T> = (raw: unknown) => { value: T } | { code: string };

export function field<T>(check: Check<T>) {
  return z.unknown().transform((raw, ctx): T => {
    const result = check(raw);
    if ('value' in result) return result.value;
    ctx.addIssue({ code: 'custom', message: result.code });
    return z.NEVER;
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-.\s]+$/;

import { isCommonPassword } from './common-passwords.js';
import { isUuid } from './uuid.js';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// Trimmed text; `null` when it is missing or empty. Wrong type and too long are errors either way.
function text(raw: unknown, max: number): { value: string | null } | { code: string } {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
  const value = raw.trim();
  if (value === '') return { value: null };
  if (value.length > max) return { code: 'TOO_LONG' };
  return { value };
}

// Required text: missing or empty is REQUIRED, too long TOO_LONG, not text INVALID_FORMAT.
export const requiredText = (max: number) =>
  field<string>((raw) => {
    const result = text(raw, max);
    if ('code' in result) return result;
    return result.value === null ? { code: 'REQUIRED' } : { value: result.value };
  });

// Optional text: missing or empty is null.
export const optionalText = (max: number) => field<string | null>((raw) => text(raw, max));

export const email = () =>
  field<string>((raw) => {
    const result = text(raw, 254);
    if ('code' in result) return result;
    if (result.value === null) return { code: 'REQUIRED' };
    return EMAIL_REGEX.test(result.value) ? { value: result.value } : { code: 'INVALID_EMAIL' };
  });

// The address a person signs in with: compared in lower case everywhere.
export const accountEmail = () => email().transform((value) => value.toLowerCase());

export const phone = () =>
  field<string | null>((raw) => {
    const result = text(raw, 30);
    if ('code' in result || result.value === null) return result;
    return PHONE_REGEX.test(result.value) ? result : { code: 'INVALID_FORMAT' };
  });

export const integer = (min: number, max: number) =>
  field<number>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    if (typeof raw !== 'number' || !Number.isInteger(raw)) return { code: 'INVALID_FORMAT' };
    if (raw < min || raw > max) return { code: 'OUT_OF_RANGE' };
    return { value: raw };
  });

// The KVKK consent counts only as the boolean `true`.
export const consent = () =>
  field<true>((raw) => (raw === true ? { value: true } : { code: 'CONSENT_REQUIRED' }));

// A flag that may be left out (null when it is); anything but a boolean is INVALID_FORMAT.
export const optionalFlag = () =>
  field<boolean | null>((raw) => {
    if (raw === undefined || raw === null) return { value: null };
    return typeof raw === 'boolean' ? { value: raw } : { code: 'INVALID_FORMAT' };
  });

// Passwords are never trimmed. A `new` password is the one that must meet the length rule and is not on the
// list of common passwords; one that is only presented (sign-in, the current password) just may not be absurdly long, which keeps the server from
// being tired out by a huge input without saying which rule was broken.
export const password = (kind: 'new' | 'presented') =>
  field<string>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    if (typeof raw !== 'string') return { code: 'INVALID_FORMAT' };
    if (kind === 'new' && raw.length < PASSWORD_MIN) return { code: 'TOO_SHORT' };
    if (raw.length > PASSWORD_MAX) return { code: 'TOO_LONG' };
    // Only a password being chosen is checked against the list, never one being presented at sign-in.
    if (kind === 'new' && isCommonPassword(raw)) return { code: 'PASSWORD_TOO_COMMON' };
    return { value: raw };
  });

// An id. Required ones are REQUIRED when missing; optional ones are null.
const uuidField = (required: boolean) =>
  field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return required ? { code: 'REQUIRED' } : { value: null };
    return isUuid(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
  });
export const requiredUuid = () => uuidField(true) as unknown as z.ZodType<string>;
export const optionalUuid = () => uuidField(false);

// One of a fixed list of values; missing is REQUIRED (or null when optional), anything else INVALID_FORMAT.
const choiceField = <T extends string>(values: readonly T[], required: boolean) =>
  field<T | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return required ? { code: 'REQUIRED' } : { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw)
      ? { value: raw as T }
      : { code: 'INVALID_FORMAT' };
  });
export const oneOf = <T extends string>(values: readonly T[]) => choiceField(values, true) as unknown as z.ZodType<T>;
export const optionalOneOf = <T extends string>(values: readonly T[]) => choiceField(values, false);

// A date and time on the half hour (the booking slots), as an ISO string in and a Date out.
export const slotDate = () =>
  field<Date>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { code: 'REQUIRED' };
    const parsed = typeof raw === 'string' ? new Date(raw) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return { code: 'INVALID_FORMAT' };
    const slot =
      (parsed.getUTCMinutes() === 0 || parsed.getUTCMinutes() === 30) &&
      parsed.getUTCSeconds() === 0 &&
      parsed.getUTCMilliseconds() === 0;
    return slot ? { value: parsed } : { code: 'NOT_IN_SLOT' };
  });
