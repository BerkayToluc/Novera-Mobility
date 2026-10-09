import type { useFormatter } from "next-intl";
import type { Money } from "./currency";

type Formatter = ReturnType<typeof useFormatter>;

// How every price is shown (SPEC §4): the currency's own sign, and decimals only when
// there is something to show. "₺1.250" and "₺1.250,50" in Turkish, "₺1,250" and
// "₺1,250.50" in English, "€36.40" and so on. `narrowSymbol` keeps English from
// printing "TRY 1,250".
//
// A whole amount shows no decimals, an amount with kuruş or cents always shows two:
// rounding to whole units would make the lines of a booking summary stop adding up to
// its total, so amounts are never rounded for display.
//
// `format` is next-intl's formatter (`useFormatter()` or `await getFormatter()`).
export function formatMoney(format: Formatter, { amount, currency }: Money): string {
  const whole = amount % 100 === 0;
  return format.number(amount / 100, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}
