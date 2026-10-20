"use server";

import { cookies } from "next/headers";
import { apiRequest } from "./api-request";
import type { components } from "./api-types";
import { CURRENCY_COOKIE, CURRENCY_COOKIE_MAX_AGE } from "./currency";
import { MOCK_PREFERENCES_COOKIE, parsePreferences } from "./preferences";
import { MOCK_GOOGLE_COOKIE, MOCK_SESSION_COOKIE, type AccountType } from "./session";
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

// What came of a Google sign-in. `consent_required`: the Google account has no Novera account yet, and
// opening one needs the privacy consent; `not_allowed`: a corporate account cannot use Google;
// `invalid_token`: Google's token was not accepted; `not_configured`: the API has no Google client set.
export type GoogleSignInResult =
  | { ok: true; locale: "tr" | "en" | null }
  | { ok: false; reason: "consent_required" | "not_allowed" | "invalid_token" | "rate_limited" | "not_configured" | "unavailable" };

// `POST /auth/google`: the ID token (`credential`) Google's button gave the browser. 200 is an account that
// exists (a password account with the same e-mail is tied to Google, and its password is dropped), 201 a new
// one, which needs `consent: true`; without it the API answers 422 CONSENT_REQUIRED and opens nothing, and
// the form asks and sends the same credential again. With USE_MOCKS=1 the sample account signs in, and the
// MOCK_GOOGLE_COOKIE hook plays the other answers.
export async function signInWithGoogle(credential: string, consent?: boolean): Promise<GoogleSignInResult> {
  if (typeof credential !== "string" || credential === "") return { ok: false, reason: "invalid_token" };

  if (!mocksEnabled()) {
    const result = await apiRequest<User>("POST", "/auth/google", { credential, ...(consent ? { consent: true } : {}) });
    if (result.status === "ok") {
      if (!(await keepSession(result.sessionCookie))) return { ok: false, reason: "unavailable" };
      return { ok: true, locale: await applyPreferences(result.data) };
    }
    if (result.status === "invalid" && result.fieldErrors.consent === "CONSENT_REQUIRED") return { ok: false, reason: "consent_required" };
    if (result.status === "forbidden") return { ok: false, reason: "not_allowed" };
    if (result.status === "unauthorized") return { ok: false, reason: "invalid_token" };
    if (result.status === "rate_limited") return { ok: false, reason: "rate_limited" };
    if (result.status === "unavailable" && result.code === "GOOGLE_SIGNIN_UNAVAILABLE") return { ok: false, reason: "not_configured" };
    return { ok: false, reason: "unavailable" };
  }

  const jar = await cookies();
  const hook = jar.get(MOCK_GOOGLE_COOKIE)?.value;
  if (hook === "corporate") return { ok: false, reason: "not_allowed" };
  if (hook === "invalid") return { ok: false, reason: "invalid_token" };
  if (hook === "limit") return { ok: false, reason: "rate_limited" };
  if (hook === "down") return { ok: false, reason: "not_configured" };
  if (hook === "new") {
    if (!consent) return { ok: false, reason: "consent_required" };
    jar.delete(MOCK_GOOGLE_COOKIE);
    jar.set(MOCK_SESSION_COOKIE, "google", { httpOnly: true, sameSite: "lax", path: "/" });
    return { ok: true, locale: null };
  }
  jar.set(MOCK_SESSION_COOKIE, "individual", { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true, locale: parsePreferences(jar.get(MOCK_PREFERENCES_COOKIE)?.value)?.locale ?? null };
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
