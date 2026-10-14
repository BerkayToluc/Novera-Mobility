import type { Currency, Money } from "./currency";
import { extraCost, type Extra } from "./extra";

export type PriceSummary = {
  vehicleTotal: Money;
  extraLines: { extra: Extra; cost: Money }[];
  // A campaign code taken off the whole booking; null when there is none (or it is not a code).
  discount: { code: string; percent: number; amount: Money } | null;
  total: Money;
};

// The lines of a price and their sum, in one place so the car page and the booking summary
// can never disagree. Nothing is rounded: every line is a whole number of kuruş or cents, so
// the lines always add up to the total (SPEC §4). `days` is null before dates are chosen,
// when only a one-day price per extra makes sense and the car itself is not totalled.
export function summarize(
  dailyPrice: Money,
  days: number | null,
  extras: Extra[],
  promo?: { code: string; percent: number },
): PriceSummary {
  const { currency } = dailyPrice;
  const money = (amount: number): Money => ({ amount, currency: currency as Currency });
  const vehicleTotal = money(days ? dailyPrice.amount * days : 0);
  const extraLines = extras.map((extra) => ({ extra, cost: extraCost(extra, days ?? 1) }));
  const subtotal = extraLines.reduce((sum, line) => sum + line.cost.amount, vehicleTotal.amount);
  // Rounded down to a whole kuruş or cent, so the discount is never more than the percentage says
  // and the lines still add up to the total.
  const discount = promo ? { ...promo, amount: money(Math.floor((subtotal * promo.percent) / 100)) } : null;
  const total = money(subtotal - (discount?.amount.amount ?? 0));
  return { vehicleTotal, extraLines, discount, total };
}
