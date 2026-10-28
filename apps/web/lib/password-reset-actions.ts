"use server";

import { apiRequest } from "./api-request";
import { forgotPasswordSchema, resetPasswordSchema, type AuthErrorMessages } from "./auth-schemas";
import { isMockMode } from "./mode";
import { codeMessages } from "./validation";

const messages = codeMessages<AuthErrorMessages>();

export type ForgotPasswordResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid" | "rate_limited"; retryAfter?: number | null };

// `POST /auth/forgot-password`. The API answers 202 whether or not the address has an account, so
// the form cannot be used to find out who is registered. With USE_MOCKS=1 and no API_URL the request
// is accepted and nothing is sent; with neither, the visitor is told the service is unavailable.
export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema(messages).safeParse({ email });
  if (!parsed.success) return { ok: false, reason: "invalid" };
  email = parsed.data.email;

  if (process.env.API_URL) {
    const result = await apiRequest("POST", "/auth/forgot-password", { email });
    if (result.status === "ok") return { ok: true };
    if (result.status === "invalid") return { ok: false, reason: "invalid" };
    if (result.status === "rate_limited") return { ok: false, reason: "rate_limited", retryAfter: result.retryAfter };
    return { ok: false, reason: "unavailable" };
  }
  return isMockMode() ? { ok: true } : { ok: false, reason: "unavailable" };
}

// `invalid_link`: the link is wrong, used or older than an hour (the API does not tell these apart).
// `too_short`: the password broke the length rule; the link is not spent in that case.
export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; reason: "invalid_link" | "too_short" | "too_common" | "rate_limited" | "unavailable"; retryAfter?: number | null };

// `POST /auth/reset-password`. Success ends every session of the account, so the visitor signs in
// again. With USE_MOCKS=1 and no API_URL any token is accepted, except `expired`, which plays a link
// that no longer works so that screen can be reached without a real e-mail.
export async function resetPassword(token: string, password: string): Promise<ResetPasswordResult> {
  if (typeof token !== "string" || token.trim() === "") return { ok: false, reason: "invalid_link" };
  if (!resetPasswordSchema(messages).safeParse({ password }).success) return { ok: false, reason: "too_short" };

  if (process.env.API_URL) {
    const result = await apiRequest("POST", "/auth/reset-password", { token, password });
    if (result.status === "ok") return { ok: true };
    if (result.status === "rate_limited") return { ok: false, reason: "rate_limited", retryAfter: result.retryAfter };
    if (result.status === "invalid") {
      if (result.code === "RESET_TOKEN_INVALID") return { ok: false, reason: "invalid_link" };
      if (result.fieldErrors.password === "TOO_SHORT") return { ok: false, reason: "too_short" };
      if (result.fieldErrors.password === "PASSWORD_TOO_COMMON") return { ok: false, reason: "too_common" };
    }
    return { ok: false, reason: "unavailable" };
  }
  if (!isMockMode()) return { ok: false, reason: "unavailable" };
  return token === "expired" ? { ok: false, reason: "invalid_link" } : { ok: true };
}
