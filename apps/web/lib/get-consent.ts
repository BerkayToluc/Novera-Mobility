import "server-only";
import { cookies } from "next/headers";
import { CONSENT_COOKIE, parseConsent, type Consent } from "./consent";

// What the visitor chose, or null if they have not answered. The server reads it like the
// theme cookie, so the banner is in the first HTML and anything that needs consent (analytics,
// BACKLOG Y27) is simply not written without it.
export async function getConsent(): Promise<Consent | null> {
  return parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
}
