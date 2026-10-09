import type { Money } from "./currency";
import type { LocalizedText } from "./vehicle";

// Interim shape mirroring the Prisma Extra (BACKLOG #21 serves it). PER_DAY extras are
// charged for every rental day, FIXED ones once.
export type ExtraPricing = "PER_DAY" | "FIXED";

export type Extra = { slug: string; name: LocalizedText; price: Money; pricing: ExtraPricing };

export function extraCost(extra: Extra, days: number): Money {
  const times = extra.pricing === "PER_DAY" ? days : 1;
  return { amount: extra.price.amount * times, currency: extra.price.currency };
}
