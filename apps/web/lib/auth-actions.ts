"use server";

import { cookies } from "next/headers";
import { MOCK_SESSION_COOKIE, type AccountType } from "./session";

export type SignInResult = { ok: true } | { ok: false; reason: "unavailable" | "invalid" };

// The sign-in call of the auth API does not exist yet (BACKLOG #25). With USE_MOCKS=1 any
// well-formed credentials are accepted and the sample account of that tab is signed in; without
// it the visitor is told the service is unavailable, never given a fake "signed in".
export async function signIn(kind: AccountType, email: string, password: string): Promise<SignInResult> {
  if (kind !== "individual" && kind !== "corporate") return { ok: false, reason: "invalid" };
  if (!email.includes("@") || password === "") return { ok: false, reason: "invalid" };
  if (process.env.USE_MOCKS !== "1") return { ok: false, reason: "unavailable" };

  (await cookies()).set(MOCK_SESSION_COOKIE, kind, { httpOnly: true, sameSite: "lax", path: "/" });
  return { ok: true };
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(MOCK_SESSION_COOKIE);
}
