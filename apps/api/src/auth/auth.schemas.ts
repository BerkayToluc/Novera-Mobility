import { z } from 'zod';
import {
  accountEmail,
  consent,
  optionalFlag,
  optionalText,
  oneOf,
  password,
  requiredText,
} from '../common/zod-fields.js';

// Bodies of the auth and /me endpoints (ARCHITECTURE ADR-26, openapi.yaml). The addresses are compared in
// lower case, so the schema lowers them.
export const registerSchema = z.object({
  email: accountEmail(),
  firstName: requiredText(80),
  lastName: requiredText(80),
  password: password('new'),
  consent: consent(),
});

// Only "not empty" and not absurdly long: the password rules apply when choosing one, not when signing in.
export const loginSchema = z.object({
  email: accountEmail(),
  password: password('presented'),
});

// `consent` is checked later, and only when the call would open a new account.
export const googleSchema = z.object({
  credential: requiredText(4096),
  consent: optionalFlag(),
});

// A password that may be left out; when given it is only checked for not being absurdly long.
function optionalPresentedPassword() {
  return z.unknown().transform((raw, ctx): string | null => {
    if (raw === undefined || raw === null || raw === '') return null;
    const result = password('presented').safeParse(raw);
    if (result.success) return result.data;
    ctx.addIssue({ code: 'custom', message: result.error.issues[0]?.message ?? 'INVALID_FORMAT' });
    return z.NEVER;
  });
}

export const forgotPasswordSchema = z.object({ email: accountEmail() });

export const resetPasswordSchema = z.object({
  token: requiredText(200),
  password: password('new'),
});

export const changePasswordSchema = z.object({
  currentPassword: password('presented'),
  newPassword: password('new'),
});

// DELETE /me: an account with a password asks for it; one opened with Google (no password) asks for the e-mail address.
// Which of the two is needed depends on the account, so the service checks that; here each only has to be text.
export const deleteAccountSchema = z.object({
  currentPassword: optionalPresentedPassword(),
  confirmEmail: optionalText(254),
});

export const LOCALES = { tr: 'TR', en: 'EN' } as const;
export const THEMES = { light: 'LIGHT', dark: 'DARK', system: 'SYSTEM' } as const;
export const CURRENCIES = ['TRY', 'EUR', 'USD'] as const;

// PATCH /me: only the fields that are sent change. The e-mail cannot be changed (it is dropped).
const optionalName = () =>
  z.unknown().transform((raw, ctx): string | undefined => {
    if (raw === undefined) return undefined;
    // A name that is sent as null is not "no change": it is a wrong value.
    if (raw === null) {
      ctx.addIssue({ code: 'custom', message: 'INVALID_FORMAT' });
      return z.NEVER;
    }
    const result = requiredText(80).safeParse(raw);
    if (result.success) return result.data;
    ctx.addIssue({ code: 'custom', message: result.error.issues[0]?.message ?? 'INVALID_FORMAT' });
    return z.NEVER;
  });

const notifications = z.unknown().transform((raw, ctx): { reminders?: boolean; campaigns?: boolean } | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_FORMAT' });
    return z.NEVER;
  }
  const { reminders, campaigns } = raw as Record<string, unknown>;
  const flag = (value: unknown) => value === undefined || typeof value === 'boolean';
  if (!flag(reminders) || !flag(campaigns)) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_FORMAT' });
    return z.NEVER;
  }
  return { reminders: reminders as boolean | undefined, campaigns: campaigns as boolean | undefined };
});

// An enum that may be left out; a value outside the list is INVALID_FORMAT.
const optionalChoice = <T extends string>(values: readonly T[]) =>
  z.unknown().transform((raw, ctx): T | undefined => {
    if (raw === undefined) return undefined;
    const result = oneOf(values).safeParse(raw);
    if (raw !== null && result.success) return result.data;
    ctx.addIssue({ code: 'custom', message: 'INVALID_FORMAT' });
    return z.NEVER;
  });

export const updateProfileSchema = z.object({
  firstName: optionalName(),
  lastName: optionalName(),
  locale: optionalChoice(['tr', 'en'] as const),
  theme: optionalChoice(['light', 'dark', 'system'] as const),
  currency: optionalChoice(CURRENCIES),
  notifications,
});
