import { describe, expect, it } from "vitest";
import type { BranchOption } from "@/lib/branch-options";
import { distanceKm, nearestBranch } from "@/lib/nearest-branch";

const branch = (id: string, latitude: number, longitude: number): BranchOption => ({
  id,
  label: id,
  latitude,
  longitude,
  openingHours: { weekdays: null, saturday: null, sunday: null },
});

const KADIKOY = branch("kadikoy", 40.9899, 29.0258);
const AIRPORT = branch("havalimani", 41.2753, 28.7519);
const ANKARA = branch("ankara", 40.1281, 32.9951);
const IZMIR = branch("izmir", 38.2924, 27.1568);

describe("distanceKm", () => {
  it("is zero at the same place and symmetric", () => {
    expect(distanceKm(KADIKOY, KADIKOY)).toBe(0);
    expect(distanceKm(KADIKOY, ANKARA)).toBeCloseTo(distanceKm(ANKARA, KADIKOY), 6);
  });
  it("reads about 350 km between Istanbul and Ankara", () => {
    const km = distanceKm(KADIKOY, ANKARA);
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(370);
  });
});

describe("nearestBranch", () => {
  const all = [ANKARA, IZMIR, AIRPORT, KADIKOY];

  it("picks the closest branch whatever the order", () => {
    // Moda, a few minutes from Kadikoy.
    expect(nearestBranch(all, { latitude: 40.98, longitude: 29.03 })?.option.id).toBe("kadikoy");
    // Near Manisa: Izmir is closer than Istanbul.
    expect(nearestBranch(all, { latitude: 38.6, longitude: 27.4 })?.option.id).toBe("izmir");
  });

  it("says how far it is", () => {
    expect(nearestBranch(all, { latitude: 40.9899, longitude: 29.0258 })?.km).toBe(0);
  });

  it("is null when there are no branches", () => {
    expect(nearestBranch([], { latitude: 41, longitude: 29 })).toBeNull();
  });
});
