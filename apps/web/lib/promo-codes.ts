// Campaign codes (SPEC §2.3). What a code is worth is decided by the API (`POST /reservations/price` takes a `promoCode`
// and answers with the discount, ARCHITECTURE ADR-15); the codes themselves are kept in the panel (V2-26). The sample mode
// has its own list in mocks/promo-codes.ts. This file only knows how a code is written.

// What a visitor typed, made comparable: no spaces, upper case, letters and digits only. Anything
// else is not a code and is dropped, so it never travels in an address.
export function normalizePromo(raw: string | undefined): string | undefined {
  const code = (raw ?? "").trim().toLocaleUpperCase("en").replace(/\s+/g, "");
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : undefined;
}
