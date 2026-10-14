import { describe, expect, it } from "vitest";
import { parseCities } from "@/components/ui/city-picker";
import { MAX_QUOTE_CITIES, TURKISH_CITIES } from "@/lib/turkish-cities";

describe("the list of cities", () => {
  it("has the 81 provinces once each, sorted the Turkish way", () => {
    expect(TURKISH_CITIES).toHaveLength(81);
    expect(new Set(TURKISH_CITIES).size).toBe(81);
    expect(TURKISH_CITIES.indexOf("Çanakkale")).toBeGreaterThan(TURKISH_CITIES.indexOf("Bursa"));
    expect(TURKISH_CITIES.indexOf("Çanakkale")).toBeLessThan(TURKISH_CITIES.indexOf("Denizli"));
    expect(TURKISH_CITIES.indexOf("İstanbul")).toBeGreaterThan(TURKISH_CITIES.indexOf("Isparta"));
  });
  it("keeps the longest allowed choice inside the form's 200 characters", () => {
    const longest = [...TURKISH_CITIES].sort((a, b) => b.length - a.length).slice(0, MAX_QUOTE_CITIES).join(", ");
    expect(longest.length).toBeLessThanOrEqual(200);
  });
  it("reads the chosen cities back from the joined string", () => {
    expect(parseCities("İstanbul, Ankara")).toEqual(["İstanbul", "Ankara"]);
    expect(parseCities("")).toEqual([]);
    expect(parseCities(" İzmir ,, ")).toEqual(["İzmir"]);
  });
});
