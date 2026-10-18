"use server";

import { cookies } from "next/headers";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import { NOTIFY_COOKIE, parseNotifications, SESSIONS_REVOKED_COOKIE, type Notifications } from "./notifications";
import type { ProfileInput } from "./profile-schemas";
import { getSession, MOCK_SESSION_COOKIE } from "./session";
import { SESSION_COOKIE } from "./session-cookie";

// The account actions behind the profile and settings pages (SPEC §2.9, v0.8): `PATCH /me`,
// `POST /me/password`, `DELETE /me/sessions` and `DELETE /me`. With USE_MOCKS=1 they are simulated (a
// cookie keeps what was chosen), otherwise they go to the API, and nobody is given a fake success.
// `incorrect`: the current password is wrong; `rate_limited`: too many tries.
export type ActionResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid" | "incorrect" | "rate_limited" | "signin" };

type User = components["schemas"]["User"];

const mocksEnabled = () => process.env.USE_MOCKS === "1";

async function signedIn(): Promise<boolean> {
  return (await getSession()) !== null;
}

// Turns an API answer that carries no data of interest into the result the forms understand.
function outcome(result: Awaited<ReturnType<typeof apiRequest>>): ActionResult {
  if (result.status === "ok") return { ok: true };
  if (result.status === "unauthorized") return { ok: false, reason: "signin" };
  if (result.status === "invalid") return { ok: false, reason: "invalid" };
  if (result.status === "rate_limited") return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "unavailable" };
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (firstName === "" || lastName === "") return { ok: false, reason: "invalid" };
  if (mocksEnabled()) return { ok: false, reason: "unavailable" };
  return outcome(await apiRequest<User>("PATCH", "/me", { firstName, lastName }));
}

export async function saveNotifications(input: Notifications): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  const parsed = parseNotifications(JSON.stringify(input));
  if (!parsed) return { ok: false, reason: "invalid" };
  if (!mocksEnabled()) return outcome(await apiRequest<User>("PATCH", "/me", { notifications: parsed }));
  (await cookies()).set(NOTIFY_COOKIE, JSON.stringify(parsed), { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

export async function changePassword(current: string, next: string): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  // The same rule as sign-up (lib/auth-schemas.ts): at least eight characters, and not the old one.
  if (current === "" || next.length < 8 || next === current) return { ok: false, reason: "invalid" };
  if (mocksEnabled()) return { ok: true };

  const result = await apiRequest("POST", "/me/password", { currentPassword: current, newPassword: next });
  if (result.status === "invalid" && result.fieldErrors.currentPassword === "INCORRECT") {
    return { ok: false, reason: "incorrect" };
  }
  return outcome(result);
}

export async function revokeOtherSessions(): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  if (!mocksEnabled()) return outcome(await apiRequest("DELETE", "/me/sessions"));
  (await cookies()).set(SESSIONS_REVOKED_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

// `DELETE /me`: the account goes and the session ends, so the cookies are dropped here too.
export async function deleteMyAccount(): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, reason: "signin" };
  if (mocksEnabled()) return { ok: false, reason: "unavailable" };
  const result = outcome(await apiRequest("DELETE", "/me"));
  if (result.ok) {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(MOCK_SESSION_COOKIE);
  }
  return result;
}
