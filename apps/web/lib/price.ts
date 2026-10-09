// How every price is shown (SPEC §4): the lira sign, no decimals, in both languages:
// "₺1.250" in Turkish, "₺1,250" in English. `narrowSymbol` is what keeps English from
// printing "TRY 1,250".
//
// The API sends whole kuruş (125000 = ₺1.250), so divide by 100 first:
//   format.number(kurusToLira(totalPrice), PRICE_FORMAT)
//
// Rounding to whole lira is only safe while prices are whole lira. Before an amount with
// kuruş is shown (e.g. a booking summary that adds line items), revisit this so the
// displayed lines still add up to the displayed total.
export const PRICE_FORMAT = {
  style: "currency",
  currency: "TRY",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
} as const;

export function kurusToLira(kurus: number): number {
  return kurus / 100;
}
