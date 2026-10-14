import type { Money } from "./currency";

// The points rule (SPEC §2.9, decided with the backend on 10 October 2026): one point for every
// ₺100 spent. Amounts are whole kuruş, so ₺100 is 10 000 of them; the remainder earns nothing.
export const POINT_STEP: Money = { amount: 10_000, currency: "TRY" };

// Only a lira total can be turned into points here: the exchange rate belongs to the backend
// (ARCHITECTURE ADR-15). Once the API returns the points of a reservation, this goes away.
export function pointsForTotal(total: Money): number {
  if (total.currency !== POINT_STEP.currency) return 0;
  return Math.floor(total.amount / POINT_STEP.amount);
}

// Interim shape of `GET /me/points` (BACKLOG Y46): what the account has earned so far, and what
// is on its way from rentals not yet completed.
export type PointsEntry = { id: string; date: string; reservationNumber: string; points: number };

export type PointsAccount = { balance: number; pending: number; entries: PointsEntry[] };

// Paying with points (SPEC §2.3, G's decision): one point is worth one lira, and points cover at
// most half of a total, so a rental is never free. Only lira totals, like earning (above).
export const POINT_VALUE: Money = { amount: 100, currency: "TRY" };
export const MAX_POINTS_SHARE = 0.5;

export function redeemablePoints(balance: number, total: Money): number {
  if (total.currency !== POINT_VALUE.currency) return 0;
  const cap = Math.floor((total.amount * MAX_POINTS_SHARE) / POINT_VALUE.amount);
  return Math.max(0, Math.min(Math.floor(balance), cap));
}

// What is left to pay in money once the points are spent.
export function afterPoints(total: Money, points: number): Money {
  return { amount: total.amount - points * POINT_VALUE.amount, currency: total.currency };
}
