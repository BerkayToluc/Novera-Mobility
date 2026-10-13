import { afterEach, describe, expect, it, vi } from "vitest";
import { inCity, matchesBranch, normalizeSearch, type BranchDetail, branchKind } from "@/lib/branch-detail";
import { telHref } from "@/lib/company";
import { groupFleet } from "@/lib/fleet-models";
import { createHold, getHold, HOLD_MINUTES } from "@/lib/hold-client";
import { branchJsonLd } from "@/lib/structured-data";
import type { Vehicle } from "@/lib/vehicle";
import { MOCK_RESERVATIONS, mockPoints } from "@/mocks/reservations";

afterEach(() => vi.unstubAllEnvs());

const branch = (overrides: Partial<BranchDetail> = {}): BranchDetail => ({
  id: "izmir-adnan-menderes",
  name: "Adnan Menderes Havalimanı",
  city: "İzmir",
  address: "Gaziemir Havalimanı İç Hatlar Gelen, Gaziemir",
  latitude: 38.29,
  longitude: 27.15,
  phone: "+90 232 555 01 06",
  email: "izmir@novera.example",
  openingHours: {
    weekdays: { open: "00:00", close: "24:00" },
    saturday: { open: "00:00", close: "24:00" },
    sunday: null,
  },
  ...overrides,
});

describe("branch search", () => {
  it("ignores case, accents and the Turkish dotted I", () => {
    expect(normalizeSearch("İZMİR")).toBe("izmir");
    expect(normalizeSearch("Şişli")).toBe("sisli");
    expect(normalizeSearch(" ızmır ")).toBe("izmir");
  });

  it("finds a branch by city, name or address", () => {
    expect(matchesBranch(branch(), "izmir")).toBe(true);
    expect(matchesBranch(branch(), "havalimani")).toBe(true);
    expect(matchesBranch(branch(), "gaziemir")).toBe(true);
    expect(matchesBranch(branch(), "ankara")).toBe(false);
    expect(matchesBranch(branch(), "")).toBe(true);
  });

  it("filters by city, and shows everything for an empty city", () => {
    expect(inCity(branch(), "İzmir")).toBe(true);
    expect(inCity(branch(), "Ankara")).toBe(false);
    expect(inCity(branch(), "")).toBe(true);
  });
});

describe("groupFleet", () => {
  const car = (id: string, modelSlug: string, branchId: string, lira: number, classSlug: string): Vehicle => ({
    id,
    slug: id,
    modelSlug,
    brand: "Marka",
    model: modelSlug,
    year: 2026,
    seats: 5,
    bags: 2,
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    consumption: { value: 5, unit: "L_PER_100KM" },
    description: { tr: "açıklama", en: "description" },
    dailyPrice: { amount: lira * 100, currency: "TRY" },
    imageUrl: null,
    vehicleClass: { slug: classSlug, name: { tr: classSlug, en: classSlug } },
    branchId,
  });
  const branches = [
    { id: "a", name: "A", city: "İzmir" },
    { id: "b", name: "B", city: "Ankara" },
  ];

  it("folds the cars of one model into one entry with the lowest price and all its branches", () => {
    const [category] = groupFleet([car("1", "clio", "a", 900, "eco"), car("2", "clio", "b", 800, "eco")], branches, "tr");
    expect(category.models).toHaveLength(1);
    expect(category.models[0].fromPrice.amount).toBe(80000);
    expect(category.models[0].branches.map((item) => item.city)).toEqual(["Ankara", "İzmir"]);
  });

  it("orders classes and models from the cheapest up", () => {
    const result = groupFleet(
      [car("1", "suv-1", "a", 2000, "suv"), car("2", "eco-1", "a", 700, "eco"), car("3", "eco-2", "a", 600, "eco")],
      branches,
      "tr",
    );
    expect(result.map((category) => category.slug)).toEqual(["eco", "suv"]);
    expect(result[0].models.map((model) => model.slug)).toEqual(["eco-2", "eco-1"]);
  });
});

describe("holds (sample data)", () => {
  it("holds a car for 15 minutes", async () => {
    vi.stubEnv("USE_MOCKS", "1");
    const before = Date.now();
    const hold = await createHold("clio");
    const length = new Date(hold.expiresAt).getTime() - before;
    expect(length).toBeGreaterThanOrEqual(HOLD_MINUTES * 60_000 - 1000);
    expect(length).toBeLessThanOrEqual(HOLD_MINUTES * 60_000 + 1000);
  });

  it("finds a live hold for its own car only", async () => {
    vi.stubEnv("USE_MOCKS", "1");
    const hold = await createHold("clio");
    expect(await getHold(hold.id, "clio")).toMatchObject({ id: hold.id });
    expect(await getHold(hold.id, "egea")).toBeNull();
  });

  it("treats an expired or malformed hold as over", async () => {
    vi.stubEnv("USE_MOCKS", "1");
    expect(await getHold("1000.clio", "clio")).toBeNull();
    expect(await getHold("garbage", "clio")).toBeNull();
  });

  it("pretends nothing without sample data", async () => {
    vi.stubEnv("USE_MOCKS", "");
    await expect(createHold("clio")).rejects.toThrow();
  });
});

describe("structured data", () => {
  it("writes midnight closing as 23:59 and leaves closed days out", () => {
    const specs = branchJsonLd(branch()).openingHoursSpecification;
    expect(specs).toHaveLength(2);
    expect(specs[0]).toMatchObject({ opens: "00:00", closes: "23:59" });
    expect(specs.flatMap((spec) => spec.dayOfWeek)).not.toContain("Sunday");
  });
});

describe("sample account data", () => {
  it("earns points only on confirmed rentals", () => {
    for (const reservation of MOCK_RESERVATIONS) {
      if (reservation.status === "CANCELLED") expect(reservation.pointsEarned).toBe(0);
    }
  });

  it("splits points into earned and pending by the end of the rental", () => {
    const account = mockPoints(new Date("2026-10-10T12:00:00Z"));
    expect(account.balance).toBe(account.entries.reduce((sum, entry) => sum + entry.points, 0));
    expect(account.balance).toBe(165);
    expect(account.pending).toBe(75);
  });
});

describe("telHref", () => {
  it("drops the spaces", () => {
    expect(telHref("+90 212 555 00 00")).toBe("tel:+902125550000");
  });
});

describe("branchKind", () => {
  it("calls a branch whose name has Havalimanı an airport, and any other a city office", () => {
    expect(branchKind({ name: "İstanbul Havalimanı" })).toBe("airport");
    expect(branchKind({ name: "Esenboğa Havalimanı" })).toBe("airport");
    expect(branchKind({ name: "ADNAN MENDERES HAVALİMANI" })).toBe("airport");
    expect(branchKind({ name: "Kadıköy" })).toBe("city");
    expect(branchKind({ name: "Merkez" })).toBe("city");
  });
});
