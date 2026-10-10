"use server";

import { cookies } from "next/headers";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./currency";
import { MOCK_PREFERENCES_COOKIE, parsePreferences } from "./preferences";
import { MOCK_SESSION_COOKIE, type AccountType } from "./session";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "./theme";

// `locale` is the language the account asked for, so the form can open the page in it.
export type SignInResult = { ok: true; locale: "tr" | "en" | null } | { ok: false; reason: "unavailable" | "invalid" };

// The sign-in call of the auth API does not exist yet (BACKLOG #25). With USE_MOCKS=1 any
// well-formed credentials are accepted and the sample account of that tab is signed in; without
// it the visitor is told the service is unavailable, never given a fake "signed in".
export async function signIn(kind: AccountType, email: string, password: string): Promise<SignInResult> {
  if (kind !== "individual" && kind !== "corporate") return { ok: false, reason: "invalid" };
  if (!email.includes("@") || password === "") return { ok: false, reason: "invalid" };
  if (process.env.USE_MOCKS !== "1") return { ok: false, reason: "unavailable" };

  const jar = await cookies();
  jar.set(MOCK_SESSION_COOKIE, kind, { httpOnly: true, sameSite: "lax", path: "/" });

  // The account's saved preferences replace whatever this browser had (BACKLOG Y42).
  const preferences = parsePreferences(jar.get(MOCK_PREFERENCES_COOKIE)?.value);
  if (preferences) {
    jar.set(THEME_COOKIE, preferences.theme, { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" });
    jar.set(CURRENCY_COOKIE, preferences.currency, { path: "/", maxAge: CURRENCY_COOKIE_MAX_AGE, sameSite: "lax" });
  }
  return { ok: true, locale: preferences?.locale ?? null };
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(MOCK_SESSION_COOKIE);
}
