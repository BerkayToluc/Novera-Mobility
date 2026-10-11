import { CURRENCIES, parseCurrency, type Currency } from "./currency";
import { parseTheme, type Theme } from "./theme";

// What an account remembers between visits (SPEC §2.9, BACKLOG Y42): the default currency, the
// language and the theme. Saved on the account and applied when the visitor signs in.
export type Preferences = { currency: Currency; locale: "tr" | "en"; theme: Theme };

// Stands in for the account's stored preferences while there is no API (BACKLOG Y47). It
// outlives signing out, as the account's row in a database would, and is only read with USE_MOCKS=1.
export const MOCK_PREFERENCES_COOKIE = "novera-mock-prefs";

// Parses what the cookie holds, falling back field by field, so a tampered value can never
// reach the theme attribute, a price request or a redirect as an arbitrary string.
export function parsePreferences(raw: string | undefined): Preferences | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof Preferences, string>>;
    return {
      currency: CURRENCIES.includes(value.currency as Currency) ? parseCurrency(value.currency) : parseCurrency(undefined),
      locale: value.locale === "en" ? "en" : "tr",
      theme: parseTheme(value.theme),
    };
  } catch {
    return null;
  }
}
