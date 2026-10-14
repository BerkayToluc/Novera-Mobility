// Campaign codes (SPEC §2.3). They are made up, and the check below stands in for the backend:
// `POST /reservations/price` will take a `promoCode` and answer with the discount, and the page
// will keep adding nothing up itself (ARCHITECTURE ADR-15). Each code is a percentage off the
// whole booking, car and extras.
const PROMO_PERCENT: Record<string, number> = {
  NOVERA10: 10,
  HOSGELDIN: 5,
};

// What a visitor typed, made comparable: no spaces, upper case, letters and digits only. Anything
// else is not a code and is dropped, so it never travels in an address.
export function normalizePromo(raw: string | undefined): string | undefined {
  const code = (raw ?? "").trim().toLocaleUpperCase("en").replace(/\s+/g, "");
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : undefined;
}

// The percentage a code takes off, or null when there is no such code.
export function promoPercent(code: string): number | null {
  return PROMO_PERCENT[code] ?? null;
}
