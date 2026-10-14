import { describe, expect, it } from "vitest";
import type { Extra } from "@/lib/extra";
import { extraCost } from "@/lib/extra";
import { pointsForTotal } from "@/lib/points";
import { normalizePromo, promoPercent } from "@/lib/promo-codes";
import { summarize } from "@/lib/price-summary";

const try_ = (lira: number) => ({ amount: lira * 100, currency: "TRY" as const });
const perDay: Extra = { slug: "driver", name: { tr: "Ek sürücü", en: "Extra driver" }, price: try_(150), pricing: "PER_DAY" };
const fixed: Extra = { slug: "seat", name: { tr: "Koltuk", en: "Seat" }, price: try_(200), pricing: "FIXED" };

describe("extraCost", () => {
  it("charges a per-day extra for every day", () => {
    expect(extraCost(perDay, 3)).toEqual(try_(450));
  });

  it("charges a fixed extra once", () => {
    expect(extraCost(fixed, 3)).toEqual(try_(200));
  });
});

describe("summarize", () => {
  it("adds the car and the extras up exactly", () => {
    const summary = summarize(try_(800), 3, [perDay, fixed]);
    expect(summary.vehicleTotal).toEqual(try_(2400));
    expect(summary.total).toEqual(try_(2400 + 450 + 200));
    expect(summary.total.amount).toBe(
      summary.vehicleTotal.amount + summary.extraLines.reduce((sum, line) => sum + line.cost.amount, 0),
    );
  });

  it("does not total the car before dates are known", () => {
    expect(summarize(try_(800), null, []).vehicleTotal.amount).toBe(0);
  });

  it("keeps the currency of the daily price", () => {
    expect(summarize({ amount: 3000, currency: "EUR" }, 2, []).total).toEqual({ amount: 6000, currency: "EUR" });
  });
});

describe("a campaign code", () => {
  const promo = { code: "NOVERA10", percent: 10 };

  it("takes a percentage off the car and the extras together, and the lines still add up", () => {
    const summary = summarize(try_(800), 3, [perDay, fixed], promo);
    const subtotal = 2400 + 450 + 200;
    expect(summary.discount).toEqual({ code: "NOVERA10", percent: 10, amount: try_(305) });
    expect(summary.total).toEqual({ amount: subtotal * 100 - 30500, currency: "TRY" });
    expect(summary.total.amount + (summary.discount?.amount.amount ?? 0)).toBe(
      summary.vehicleTotal.amount + summary.extraLines.reduce((sum, line) => sum + line.cost.amount, 0),
    );
  });

  it("rounds the discount down to a whole kuruş, never past the percentage", () => {
    // 5% of 3333 kuruş is 166.65: 166 is taken off.
    const summary = summarize({ amount: 3333, currency: "TRY" }, 1, [], { code: "HOSGELDIN", percent: 5 });
    expect(summary.discount?.amount.amount).toBe(166);
    expect(summary.total.amount).toBe(3333 - 166);
  });

  it("is null, and the price the plain one, without a code", () => {
    const summary = summarize(try_(800), 3, []);
    expect(summary.discount).toBeNull();
    expect(summary.total).toEqual(try_(2400));
  });
});

describe("promo codes", () => {
  it("normalizes what was typed and drops what is not a code", () => {
    expect(normalizePromo(" novera10 ")).toBe("NOVERA10");
    expect(normalizePromo("nov era 10")).toBe("NOVERA10");
    expect(normalizePromo("<script>")).toBeUndefined();
    expect(normalizePromo("ab")).toBeUndefined();
    expect(normalizePromo(undefined)).toBeUndefined();
  });
  it("knows its codes and only them", () => {
    expect(promoPercent("NOVERA10")).toBe(10);
    expect(promoPercent("HOSGELDIN")).toBe(5);
    expect(promoPercent("NOPE")).toBeNull();
  });
});

describe("pointsForTotal", () => {
  it("gives one point for every full 100 lira", () => {
    expect(pointsForTotal(try_(99))).toBe(0);
    expect(pointsForTotal({ amount: 9999, currency: "TRY" })).toBe(0);
    expect(pointsForTotal(try_(100))).toBe(1);
    expect(pointsForTotal(try_(4860))).toBe(48);
    expect(pointsForTotal({ amount: 486099, currency: "TRY" })).toBe(48);
  });

  it("does not guess an exchange rate for other currencies", () => {
    expect(pointsForTotal({ amount: 500000, currency: "EUR" })).toBe(0);
  });
});
