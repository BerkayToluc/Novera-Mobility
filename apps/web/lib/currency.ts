export const CURRENCIES = ["TRY", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "TRY";

export const CURRENCY_COOKIE = "novera-currency";
// A year, like the theme: a visitor's choice should outlive a normal browsing gap.
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// The symbol is shown next to the code in the switcher; it is not translated.
export const CURRENCY_SYMBOLS: Record<Currency, string> = { TRY: "₺", EUR: "€", USD: "$" };

// An amount the way the API sends it: a whole number of the currency's smallest unit
// (kuruş or cent, 100 to the unit for all three), always together with its currency.
// 125000 TRY is ₺1.250. A bare number would not say which currency it is in.
export type Money = { amount: number; currency: Currency };

// A missing or unknown value falls back to the default, so a tampered cookie can never
// reach an API request as an arbitrary string.
export function parseCurrency(value: string | undefined): Currency {
  return CURRENCIES.find((currency) => currency === value) ?? DEFAULT_CURRENCY;
}
