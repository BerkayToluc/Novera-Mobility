"use server";

import { cookies } from "next/headers";
import { CURRENCIES, CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./currency";
import { MOCK_PREFERENCES_COOKIE, type Preferences } from "./preferences";
import { getSession } from "./session";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, THEMES } from "./theme";

export type SavePreferencesResult = { ok: true } | { ok: false; reason: "unavailable" | "invalid" | "signin" };

// `PATCH /me/preferences` does not exist yet (BACKLOG Y47). With USE_MOCKS=1 the choice is kept
// on the sample account and applied to this browser now; without it the visitor is told the
// service is unavailable instead of being shown a save that did not happen.
export async function savePreferences(input: Preferences): Promise<SavePreferencesResult> {
  if (!(await getSession())) return { ok: false, reason: "signin" };
  const valid =
    CURRENCIES.includes(input.currency) &&
    (THEMES as readonly string[]).includes(input.theme) &&
    (input.locale === "tr" || input.locale === "en");
  if (!valid) return { ok: false, reason: "invalid" };
  if (process.env.USE_MOCKS !== "1") return { ok: false, reason: "unavailable" };

  const jar = await cookies();
  jar.set(MOCK_PREFERENCES_COOKIE, JSON.stringify(input), { httpOnly: true, sameSite: "lax", path: "/", maxAge: THEME_COOKIE_MAX_AGE });
  jar.set(THEME_COOKIE, input.theme, { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" });
  jar.set(CURRENCY_COOKIE, input.currency, { path: "/", maxAge: CURRENCY_COOKIE_MAX_AGE, sameSite: "lax" });
  return { ok: true };
}
