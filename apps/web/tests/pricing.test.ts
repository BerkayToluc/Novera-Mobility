import { describe, expect, it } from "vitest";
import type { Extra } from "@/lib/extra";
import { extraCost } from "@/lib/extra";
import { pointsForTotal } from "@/lib/points";
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
