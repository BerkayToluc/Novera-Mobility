// The visitor's cookie choice (ARCHITECTURE ADR-19). Only what is not strictly needed to run
// the site (analytics) asks for consent; the theme, currency, language and session cookies are
// functional and always on.
export const CONSENT_COOKIE = "novera-consent";

// Six months, then the banner asks again.
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 183;

// Raised whenever the cookies in use change in a way that needs a new answer: a cookie written
// with an older version is treated as no answer at all.
export const CONSENT_VERSION = 1;

export type Consent = { v: number; analytics: boolean };

// Reads what the cookie holds; anything missing, malformed or from an older version is "no
// answer yet", so a tampered value can only ever make the banner reappear.
export function parseConsent(raw: string | undefined): Consent | null {
  if (!raw) return null;
  for (const candidate of [raw, safeDecode(raw)]) {
    try {
      const value = JSON.parse(candidate) as Partial<Consent>;
      if (value.v === CONSENT_VERSION && typeof value.analytics === "boolean") {
        return { v: CONSENT_VERSION, analytics: value.analytics };
      }
    } catch {
      // Try the next form.
    }
  }
  return null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function serializeConsent(analytics: boolean): string {
  return encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, analytics }));
}
