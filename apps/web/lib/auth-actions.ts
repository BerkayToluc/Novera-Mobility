"use server";

import { cookies } from "next/headers";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./currency";
import { MOCK_PREFERENCES_COOKIE, parsePreferences } from "./preferences";
import { MOCK_SESSION_COOKIE, type AccountType } from "./session";
import { SESSION_COOKIE, type SessionCookieChange } from "./session-cookie";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "./theme";

// `locale` is the language the account asked for, so the form can open the page in it.
// `invalid`: the input is malformed or, on sign-in, the e-mail or password is wrong (the API does
// not say which). `email_taken`: sign-up with an address that already has an account.
export type SignInResult =
  | { ok: true; locale: "tr" | "en" | null }
  | { ok: false; reason: "unavailable" | "invalid" | "email_taken" | "rate_limited" };

type User = components["schemas"]["User"];

// With USE_MOCKS=1 the sample accounts stand in for the API (any well-formed credentials sign in
// the sample account of that tab); otherwise the calls below go to the API, and a visitor is never
// given a fake "signed in".
const mocksEnabled = () => process.env.USE_MOCKS === "1";

// Puts the session the API started on this browser. The cookie is httpOnly, so no script can read
// it, and `secure` in production like the API's own.
async function keepSession(change: SessionCookieChange | undefined): Promise<boolean> {
  if (!change?.value) return false;
  (await cookies()).set(SESSION_COOKIE, change.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(change.expires ? { expires: change.expires } : {}),
  });
  return true;
}

// The account's saved theme and currency replace whatever this browser had (BACKLOG Y42); its
// language is returned for the form to open the page in.
async function applyPreferences(user: User): Promise<"tr" | "en"> {
  const jar = await cookies();
  jar.set(THEME_COOKIE, user.theme, { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" });
  jar.set(CURRENCY_COOKIE, user.currency, { path: "/", maxAge: CURRENCY_COOKIE_MAX_AGE, sameSite: "lax" });
  return user.locale;
}

// `POST /auth/login`: one endpoint for both tabs; a corporate account is told by `accountType` in the
// answer, not by the tab.
export async function signIn(kind: AccountType, email: string, password: string): Promise<SignInResult> {
  if (kind !== "individual" && kind !== "corporate") return { ok: false, reason: "invalid" };
  if (!email.includes("@") || password === "") return { ok: false, reason: "invalid" };

  if (!mocksEnabled()) {
    const result = await apiRequest<User>("POST", "/auth/login", { email: email.trim(), password });
    if (result.status === "ok") {
      if (!(await keepSession(result.sessionCookie))) return { ok: false, reason: "unavailable" };
      return { ok: true, locale: await applyPreferences(result.data) };
    }
    if (result.status === "unauthorized" || result.status === "invalid") return { ok: false, reason: "invalid" };
    if (result.status === "rate_limited") return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "unavailable" };
  }

  const jar = await cookies();
  jar.set(MOCK_SESSION_COOKIE, kind, { httpOnly: true, sameSite: "lax", path: "/" });

  const preferences = parsePreferences(jar.get(MOCK_PREFERENCES_COOKIE)?.value);
  if (preferences) {
    jar.set(THEME_COOKIE, preferences.theme, { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" });
    jar.set(CURRENCY_COOKIE, preferences.currency, { path: "/", maxAge: CURRENCY_COOKIE_MAX_AGE, sameSite: "lax" });
  }
  return { ok: true, locale: preferences?.locale ?? null };
}

// `POST /auth/register` (individual accounts only): a successful sign-up also signs the visitor in.
// With USE_MOCKS=1 it signs the sample individual account in.
export async function signUp(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  consent: boolean;
}): Promise<SignInResult> {
  const valid =
    input.firstName.trim() !== "" &&
    input.lastName.trim() !== "" &&
    input.email.includes("@") &&
    input.password.length >= 8 &&
    input.consent === true;
  if (!valid) return { ok: false, reason: "invalid" };
  if (mocksEnabled()) return signIn("individual", input.email, input.password);

  const result = await apiRequest<User>("POST", "/auth/register", {
    email: input.email.trim(),
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    consent: input.consent,
  });
  if (result.status === "ok") {
    if (!(await keepSession(result.sessionCookie))) return { ok: false, reason: "unavailable" };
    return { ok: true, locale: await applyPreferences(result.data) };
  }
  if (result.status === "conflict" || (result.status === "invalid" && result.fieldErrors.email === "EMAIL_TAKEN")) {
    return { ok: false, reason: "email_taken" };
  }
  if (result.status === "invalid") return { ok: false, reason: "invalid" };
  if (result.status === "rate_limited") return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "unavailable" };
}

// `POST /auth/logout` ends the session on the API; the cookies are dropped here whatever it answers,
// so this browser is signed out even when the API cannot be reached.
export async function signOut(): Promise<void> {
  if (!mocksEnabled()) await apiRequest("POST", "/auth/logout");
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(MOCK_SESSION_COOKIE);
}
