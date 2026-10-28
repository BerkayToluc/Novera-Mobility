import "server-only";
import type { cookies } from "next/headers";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./currency";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "./theme";

// The account's theme and currency, written to this browser (BACKLOG Y42). Three places did this by hand: the sign-in
// answers, the mock sign-in and the settings form (V2-14, QUALITY M-05). Not httpOnly: the page script reads them to
// paint the first frame.
type CookieJar = Awaited<ReturnType<typeof cookies>>;

export function setPreferenceCookies(jar: CookieJar, preferences: { theme: string; currency: string }): void {
  jar.set(THEME_COOKIE, preferences.theme, { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" });
  jar.set(CURRENCY_COOKIE, preferences.currency, { path: "/", maxAge: CURRENCY_COOKIE_MAX_AGE, sameSite: "lax" });
}
