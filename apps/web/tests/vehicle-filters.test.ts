import { describe, expect, it } from "vitest";
import { afterPoints, redeemablePoints } from "@/lib/points";
import { activeFilterCount, applyVehicleFilters, NO_FILTERS, parseVehicleFilters, toFilterQuery } from "@/lib/vehicle-filters";
import type { VehicleOffer } from "@/lib/vehicle";

const offer = (id: string, over: Partial<VehicleOffer> & { price: number }): VehicleOffer =>
  ({
    id,
    vehicleClass: { slug: "compact", name: { tr: "Kompakt", en: "Compact" } },
    transmission: "MANUAL",
    fuelType: "PETROL",
    seats: 5,
    year: 2024,
    dailyPrice: { amount: over.price, currency: "TRY" },
    ...over,
  }) as VehicleOffer;

const cars = [
  offer("a", { price: 90_000, seats: 4 }),
  offer("b", { price: 150_000, transmission: "AUTOMATIC", year: 2026 }),
  offer("c", { price: 220_000, fuelType: "ELECTRIC", seats: 7, year: 2025, vehicleClass: { slug: "suv", name: { tr: "SUV", en: "SUV" } } }),
];

describe("vehicle filters", () => {
  it("reads only allowed words and falls back to no filter", () => {
    expect(parseVehicleFilters({ vites: "otomatik", yakit: "elektrik", koltuk: "7", sinif: "suv", sirala: "yeni" })).toEqual({
      classSlug: "suv",
      transmission: "AUTOMATIC",
      fuel: "ELECTRIC",
      minSeats: 7,
      sort: "newest",
    });
    expect(parseVehicleFilters({ vites: "x", yakit: "y", koltuk: "99", sirala: "z" })).toEqual(NO_FILTERS);
  });

  it("round-trips through the query and leaves defaults out", () => {
    const filters = { ...NO_FILTERS, fuel: "HYBRID" as const, minSeats: 5, sort: "price-desc" as const };
    expect(toFilterQuery(filters)).toEqual({ yakit: "hibrit", koltuk: "5", sirala: "azalan" });
    expect(parseVehicleFilters(toFilterQuery(filters))).toEqual(filters);
    expect(toFilterQuery(NO_FILTERS)).toEqual({});
  });

  it("counts the narrowing filters but not the sort", () => {
    expect(activeFilterCount({ ...NO_FILTERS, sort: "newest" })).toBe(0);
    expect(activeFilterCount({ ...NO_FILTERS, fuel: "ELECTRIC", minSeats: 5 })).toBe(2);
  });

  it("filters and sorts", () => {
    expect(applyVehicleFilters([...cars], NO_FILTERS).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(applyVehicleFilters([...cars], { ...NO_FILTERS, sort: "price-desc" }).map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(applyVehicleFilters([...cars], { ...NO_FILTERS, sort: "newest" }).map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(applyVehicleFilters([...cars], { ...NO_FILTERS, minSeats: 5 }).map((c) => c.id)).toEqual(["b", "c"]);
    expect(applyVehicleFilters([...cars], { ...NO_FILTERS, transmission: "AUTOMATIC" }).map((c) => c.id)).toEqual(["b"]);
    expect(applyVehicleFilters([...cars], { ...NO_FILTERS, classSlug: "suv", fuel: "PETROL" })).toEqual([]);
  });
});

describe("paying with points", () => {
  const total = { amount: 240_000, currency: "TRY" as const };
  it("is worth a lira a point and covers at most half", () => {
    expect(redeemablePoints(340, total)).toBe(340);
    expect(redeemablePoints(5000, total)).toBe(1200);
    expect(redeemablePoints(0, total)).toBe(0);
    expect(redeemablePoints(-5, total)).toBe(0);
  });
  it("is only for lira totals", () => {
    expect(redeemablePoints(340, { amount: 24_000, currency: "EUR" })).toBe(0);
  });
  it("leaves the rest to pay in money", () => {
    expect(afterPoints(total, 340)).toEqual({ amount: 206_000, currency: "TRY" });
  });
});
