"use server";

import { cookies } from "next/headers";
import { apiRequest } from "./api-request";
import { CURRENCIES, CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./currency";
import { MOCK_PREFERENCES_COOKIE, type Preferences } from "./preferences";
import { getSession } from "./session";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, THEMES } from "./theme";

export type SavePreferencesResult = { ok: true } | { ok: false; reason: "unavailable" | "invalid" | "signin" };

// Saves the account's defaults: `PATCH /me` with the language, theme and currency. With USE_MOCKS=1 the choice
// is kept on the sample account in a cookie. Either way it is applied to this browser now; a save that
// did not happen is never shown as one.
export async function savePreferences(input: Preferences): Promise<SavePreferencesResult> {
  if (!(await getSession())) return { ok: false, reason: "signin" };
  const valid =
    CURRENCIES.includes(input.currency) &&
    (THEMES as readonly string[]).includes(input.theme) &&
    (input.locale === "tr" || input.locale === "en");
  if (!valid) return { ok: false, reason: "invalid" };

  const jar = await cookies();
  if (process.env.USE_MOCKS === "1") {
    jar.set(MOCK_PREFERENCES_COOKIE, JSON.stringify(input), { httpOnly: true, sameSite: "lax", path: "/", maxAge: THEME_COOKIE_MAX_AGE });
  } else {
    const result = await apiRequest("PATCH", "/me", { locale: input.locale, theme: input.theme, currency: input.currency });
    if (result.status !== "ok") return { ok: false, reason: result.status === "unauthorized" ? "signin" : "unavailable" };
  }
  jar.set(THEME_COOKIE, input.theme, { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" });
  jar.set(CURRENCY_COOKIE, input.currency, { path: "/", maxAge: CURRENCY_COOKIE_MAX_AGE, sameSite: "lax" });
  return { ok: true };
}
