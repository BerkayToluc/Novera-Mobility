import type { Currency, Money } from "./currency";
import { extraCost, type Extra } from "./extra";
import { POINT_VALUE, redeemablePoints } from "./points";

// Prices include VAT (KDV): 20 percent, so a sixth of a total is VAT. The summary shows how much of
// the total that is; it is not added on top (SPEC §2.3).
export const VAT_PERCENT = 20;

export type PriceSummary = {
  vehicleTotal: Money;
  extraLines: { extra: Extra; cost: Money }[];
  // The car and the extras together, before any code or points.
  subtotal: Money;
  // A campaign code taken off the whole booking; null when there is none (or it is not a code).
  discount: { code: string; percent: number; amount: Money } | null;
  // Points spent on the booking and what they are worth; null when none are used.
  points: { count: number; amount: Money } | null;
  total: Money;
  // The share of the total that is VAT (already inside it).
  vat: Money;
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
  // The points the visitor has and chose to pay with; at most half of what is left after the code.
  pointsBalance?: number,
): PriceSummary {
  const { currency } = dailyPrice;
  const money = (amount: number): Money => ({ amount, currency: currency as Currency });
  const vehicleTotal = money(days ? dailyPrice.amount * days : 0);
  const extraLines = extras.map((extra) => ({ extra, cost: extraCost(extra, days ?? 1) }));
  const subtotal = extraLines.reduce((sum, line) => sum + line.cost.amount, vehicleTotal.amount);
  // Rounded down to a whole kuruş or cent, so the discount is never more than the percentage says
  // and the lines still add up to the total.
  const discount = promo ? { ...promo, amount: money(Math.floor((subtotal * promo.percent) / 100)) } : null;
  const afterCode = subtotal - (discount?.amount.amount ?? 0);
  const count = pointsBalance ? redeemablePoints(pointsBalance, money(afterCode)) : 0;
  const points = count > 0 ? { count, amount: money(count * POINT_VALUE.amount) } : null;
  const total = money(afterCode - (points?.amount.amount ?? 0));
  const vat = money(Math.floor((total.amount * VAT_PERCENT) / (100 + VAT_PERCENT)));
  return { vehicleTotal, extraLines, subtotal: money(subtotal), discount, points, total, vat };
}
