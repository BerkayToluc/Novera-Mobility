import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { apiRequest } from "./api-request";
import { sessionFromApi } from "./api-mappers";
import type { components } from "./api-types";
import { SESSION_COOKIE } from "./session-cookie";
import type { Notifications } from "./notifications";
import type { Preferences } from "./preferences";
import type { LocalizedText } from "./vehicle";
import { isMockMode } from "./mode";

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type AccountType = "individual" | "corporate";

// What the account may do in the panel (V2-23, ADR-24). The site reads it only to decide what to show and where to
// send a visitor; the API checks the role on every call to /admin/*.
export type Role = "customer" | "admin";

// A corporate account is simple (SPEC §2.9): company details and a contact person. The fleet
// panel is out of scope.
// Only the name comes from the API; the rest is shown when it is known (the sample account has it all).
export type CompanyInfo = {
  name: string;
  taxOffice?: string;
  city?: string;
  phone?: string;
  // The sample account has it in both languages, the API sends one text.
  contactTitle?: LocalizedText | string;
  // The Novera team that opened the account and answers for it.
  salesContact?: string;
};

// `preferences` and `notifications` are what the account saved; the sample accounts keep theirs in cookies.
export type Session = {
  type: AccountType;
  role: Role;
  user: SessionUser;
  company?: CompanyInfo;
  preferences?: Preferences;
  notifications?: Notifications;
  // false for an account opened with Google that has not set a password yet; it sets one through the
  // reset link (the password change refuses it). googleLinked: the account is tied to a Google account.
  hasPassword: boolean;
  googleLinked: boolean;
};

// The cookie that stands in for the real session in development (BACKLOG #25). It only means
// something with USE_MOCKS=1; otherwise it is ignored, so a production build can never be "signed
// in" by setting a cookie by hand.
export const MOCK_SESSION_COOKIE = "novera-mock-session";

// Test hook, USE_MOCKS=1 only: what the sample Google sign-in answers. Not set: the sample account
// signs in. "new": a new account, which asks for the privacy consent first; "corporate", "invalid",
// "limit" and "down" play the refusals, so every message can be reached without Google.
export const MOCK_GOOGLE_COOKIE = "novera-mock-google";

// Who is signed in. With USE_MOCKS=1 a sample account stands in for the visitor. Otherwise the
// httpOnly session cookie the API set (session-cookie.ts, ARCHITECTURE ADR-08) is sent to `GET /me`:
// no cookie, a session the API no longer knows (401) or an API that does not answer all mean nobody
// is signed in, and every profile page shows its "sign in first" state.
// `cache` makes the layout and the page share one lookup per request.
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  if (isMockMode()) {
    const value = jar.get(MOCK_SESSION_COOKIE)?.value;
    if (value !== "corporate" && value !== "individual" && value !== "google" && value !== "admin") return null;
    const { MOCK_ADMIN, MOCK_CORPORATE, MOCK_GOOGLE, MOCK_INDIVIDUAL } = await import("@/mocks/accounts");
    return { corporate: MOCK_CORPORATE, individual: MOCK_INDIVIDUAL, google: MOCK_GOOGLE, admin: MOCK_ADMIN }[value];
  }
  if (!jar.get(SESSION_COOKIE)?.value) return null;
  const result = await apiRequest<components["schemas"]["User"]>("GET", "/me");
  return result.status === "ok" ? sessionFromApi(result.data) : null;
});
