"use server";

import { cookies } from "next/headers";
import { NOTIFY_COOKIE, parseNotifications, SESSIONS_REVOKED_COOKIE, type Notifications } from "./notifications";
import { getSession } from "./session";

// The account actions behind the settings page (SPEC §2.9, v0.8). None of the calls exist in the
// API yet (BACKLOG): with USE_MOCKS=1 they are simulated (a cookie keeps what was chosen), without
// it the visitor is told the service is unavailable, never given a fake success.
export type ActionResult = { ok: true } | { ok: false; reason: "unavailable" | "invalid" };

async function allowed(): Promise<boolean> {
  return process.env.USE_MOCKS === "1" && (await getSession()) !== null;
}

export async function saveNotifications(input: Notifications): Promise<ActionResult> {
  if (!(await allowed())) return { ok: false, reason: "unavailable" };
  const parsed = parseNotifications(JSON.stringify(input));
  if (!parsed) return { ok: false, reason: "invalid" };
  (await cookies()).set(NOTIFY_COOKIE, JSON.stringify(parsed), { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

export async function changePassword(current: string, next: string): Promise<ActionResult> {
  if (!(await allowed())) return { ok: false, reason: "unavailable" };
  // The same rule as sign-up (lib/auth-schemas.ts): at least eight characters, and not the old one.
  if (current === "" || next.length < 8 || next === current) return { ok: false, reason: "invalid" };
  return { ok: true };
}

export async function revokeOtherSessions(): Promise<ActionResult> {
  if (!(await allowed())) return { ok: false, reason: "unavailable" };
  (await cookies()).set(SESSIONS_REVOKED_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}
