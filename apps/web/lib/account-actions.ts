"use server";

import { cookies } from "next/headers";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import { NOTIFY_COOKIE, parseNotifications, SESSIONS_REVOKED_COOKIE, type Notifications } from "./notifications";
import { changePasswordSchema, type AuthErrorMessages } from "./auth-schemas";
import { profileSchema, type ProfileInput } from "./profile-schemas";
import { codeMessages } from "./validation";
import { getSession, MOCK_SESSION_COOKIE } from "./session";
import { SESSION_COOKIE } from "./session-cookie";
import { isMockMode } from "./mode";

// The account actions behind the profile and settings pages (SPEC §2.9, v0.8): `PATCH /me`,
// `POST /me/password`, `DELETE /me/sessions` and `DELETE /me`. With USE_MOCKS=1 they are simulated (a
// cookie keeps what was chosen), otherwise they go to the API, and nobody is given a fake success.
// `incorrect`: the current password is wrong; `rate_limited`: too many tries.
export type ActionResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid" | "incorrect" | "too_common" | "no_password" | "rate_limited" | "signin"; retryAfter?: number | null };

type User = components["schemas"]["User"];

// Input is checked with the schemas the forms use (ADR-26); only the field names matter here.
const messages = codeMessages<AuthErrorMessages & { same: string }>();

async function signedIn(): Promise<boolean> {
  return (await getSession()) !== null;
}

// Turns an API answer that carries no data of interest into the result the forms understand.
function outcome(result: Awaited<ReturnType<typeof apiRequest>>): ActionResult {
  if (result.status === "ok") return { ok: true };
  if (result.status === "unauthorized") return { ok: false, reason: "signin" };
  if (result.status === "invalid") return { ok: false, reason: "invalid" };
  if (result.status === "rate_limited") return { ok: false, reason: "rate_limited", retryAfter: result.retryAfter };
  return { ok: false, reason: "unavailable" };
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  const parsed = profileSchema(messages).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { firstName, lastName } = parsed.data;
  if (isMockMode()) return { ok: false, reason: "unavailable" };
  return outcome(await apiRequest<User>("PATCH", "/me", { firstName, lastName }));
}

export async function saveNotifications(input: Notifications): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  const parsed = parseNotifications(JSON.stringify(input));
  if (!parsed) return { ok: false, reason: "invalid" };
  if (!isMockMode()) return outcome(await apiRequest<User>("PATCH", "/me", { notifications: parsed }));
  (await cookies()).set(NOTIFY_COOKIE, JSON.stringify(parsed), { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

export async function changePassword(current: string, next: string): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  // The same password rule as sign-up (lib/auth-schemas.ts), and not the old one.
  const parsed = changePasswordSchema(messages).safeParse({ current, next });
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (isMockMode()) return { ok: true };

  const result = await apiRequest("POST", "/me/password", { currentPassword: parsed.data.current, newPassword: parsed.data.next });
  if (result.status === "invalid" && result.fieldErrors.currentPassword === "INCORRECT") {
    return { ok: false, reason: "incorrect" };
  }
  if (result.status === "invalid" && result.fieldErrors.newPassword === "PASSWORD_TOO_COMMON") return { ok: false, reason: "too_common" };
  // An account opened with Google has no password to change: it sets one through the reset link.
  if (result.status === "conflict" && result.code === "PASSWORD_NOT_SET") return { ok: false, reason: "no_password" };
  return outcome(result);
}

export async function revokeOtherSessions(): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  if (!isMockMode()) return outcome(await apiRequest("DELETE", "/me/sessions"));
  (await cookies()).set(SESSIONS_REVOKED_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

// `DELETE /me`: the account goes and the session ends, so the cookies are dropped here too. A stolen session
// cookie must not be enough, so a password account sends its password and a Google-only account types its
// e-mail (`incorrect`: the API said INVALID_PASSWORD or EMAIL_MISMATCH).
export async function deleteMyAccount(input: { currentPassword?: string; confirmEmail?: string }): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  const { currentPassword, confirmEmail } = input ?? {};
  if ((currentPassword !== undefined && typeof currentPassword !== "string") || (confirmEmail !== undefined && typeof confirmEmail !== "string")) {
    return { ok: false, reason: "invalid" };
  }
  if (isMockMode()) return { ok: false, reason: "unavailable" };
  const response = await apiRequest("DELETE", "/me", { currentPassword, confirmEmail });
  if (response.status === "invalid" && (response.fieldErrors.currentPassword === "INVALID_PASSWORD" || response.fieldErrors.confirmEmail === "EMAIL_MISMATCH")) {
    return { ok: false, reason: "incorrect" };
  }
  const result = outcome(response);
  if (result.ok) {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(MOCK_SESSION_COOKIE);
  }
  return result;
}
