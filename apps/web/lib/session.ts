import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { MOCK_CORPORATE, MOCK_INDIVIDUAL } from "@/mocks/accounts";
import type { LocalizedText } from "./vehicle";

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type AccountType = "individual" | "corporate";

// A corporate account is simple (SPEC §2.9): company details and a contact person. The fleet
// panel is out of scope.
export type CompanyInfo = {
  name: string;
  taxOffice: string;
  city: string;
  phone: string;
  contactTitle: LocalizedText;
  // The Novera team that opened the account and answers for it.
  salesContact: string;
};

export type Session = { type: AccountType; user: SessionUser; company?: CompanyInfo };

// The cookie that stands in for the real session while there is no auth API (BACKLOG #25).
// It only means something with USE_MOCKS=1; otherwise it is ignored, so a production build
// can never be "signed in" by setting a cookie by hand.
export const MOCK_SESSION_COOKIE = "novera-mock-session";

// With USE_MOCKS=1 a sample account stands in for the signed-in visitor. Without it nobody is
// signed in and every profile page shows its "sign in first" state, until the API lands and
// this reads the httpOnly session cookie (ARCHITECTURE ADR-08); the pages already handle both.
// `cache` makes the layout and the page share one lookup per request.
export const getSession = cache(async (): Promise<Session | null> => {
  if (process.env.USE_MOCKS !== "1") return null;
  const value = (await cookies()).get(MOCK_SESSION_COOKIE)?.value;
  if (value === "corporate") return MOCK_CORPORATE;
  if (value === "individual") return MOCK_INDIVIDUAL;
  return null;
});
