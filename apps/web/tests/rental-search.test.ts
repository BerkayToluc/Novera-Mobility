import { describe, expect, it } from "vitest";
import { localToInstant, parseRentalSearch, rentalDays, toQuery } from "@/lib/rental-search";

const valid = { alis: "istanbul-kadikoy", iade: "izmir-adnan-menderes", baslangic: "2026-10-12T10:00", bitis: "2026-10-15T10:00" };

describe("parseRentalSearch", () => {
  it("reads a complete search", () => {
    expect(parseRentalSearch(valid)).toEqual({
      pickupBranchId: "istanbul-kadikoy",
      returnBranchId: "izmir-adnan-menderes",
      startAt: "2026-10-12T10:00",
      endAt: "2026-10-15T10:00",
    });
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseRentalSearch({ ...valid, alis: ["a", "b"] })?.pickupBranchId).toBe("a");
  });

  it.each(["alis", "iade", "baslangic", "bitis"])("is null without %s", (key) => {
    expect(parseRentalSearch({ ...valid, [key]: undefined })).toBeNull();
  });

  it("is null for a malformed date", () => {
    expect(parseRentalSearch({ ...valid, baslangic: "12.10.2026 10:00" })).toBeNull();
    expect(parseRentalSearch({ ...valid, bitis: "2026-13-45T10:00" })).toBeNull();
  });

  it("is null when the return is not after the pick-up", () => {
    expect(parseRentalSearch({ ...valid, bitis: valid.baslangic })).toBeNull();
    expect(parseRentalSearch({ ...valid, bitis: "2026-10-11T10:00" })).toBeNull();
  });

  it("survives a round trip through the address", () => {
    const search = parseRentalSearch(valid)!;
    expect(parseRentalSearch(toQuery(search))).toEqual(search);
  });
});

describe("localToInstant", () => {
  it("reads wall-clock times as Istanbul time (UTC+3)", () => {
    expect(localToInstant("2026-10-12T10:00").toISOString()).toBe("2026-10-12T07:00:00.000Z");
  });
});

describe("rentalDays", () => {
  const days = (startAt: string, endAt: string) =>
    rentalDays({ pickupBranchId: "a", returnBranchId: "a", startAt, endAt });

  it("counts every started 24 hours", () => {
    expect(days("2026-10-12T10:00", "2026-10-13T10:00")).toBe(1);
    expect(days("2026-10-12T10:00", "2026-10-13T10:01")).toBe(2);
    expect(days("2026-10-12T10:00", "2026-10-15T10:00")).toBe(3);
  });

  it("is never less than one day", () => {
    expect(days("2026-10-12T10:00", "2026-10-12T12:00")).toBe(1);
  });
});
