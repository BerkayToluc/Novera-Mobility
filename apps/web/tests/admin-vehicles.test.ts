import { describe, expect, it } from "vitest";
import { extraFormSchema, extraLiraToKurus, toUpdateBody as toExtraBody } from "@/lib/admin-extras";
import { EMPTY_VEHICLE_FORM, maxYear, normalizePlate, toCreateBody, toMoveBody, vehicleFormSchema, type VehicleFormValues } from "@/lib/admin-vehicles";
import { codeMessages, invalidFields } from "@/lib/validation";
import { getMockExtra, listMockExtras, mockExtras, updateMockExtra } from "@/mocks/extras";
import { mockVehicles } from "@/mocks/models";
import { createMockVehicle, getMockVehicle, listMockVehicles, updateMockVehicle } from "@/mocks/vehicles";
import { retireMockModel } from "@/mocks/models";

// The sample store is kept per world (lib/mock-world.ts); every test has one of its own.
const everyList = { page: 1, pageSize: 100, sort: null, q: "", model: null, branch: null, status: null };
const schema = vehicleFormSchema(codeMessages());
const valid = (overrides: Partial<VehicleFormValues> = {}): VehicleFormValues => ({
  ...EMPTY_VEHICLE_FORM,
  plate: "34 abc 123",
  year: "2025",
  modelSlug: "renault-clio",
  branchId: "istanbul-kadikoy",
  ...overrides,
});
const fieldsOf = (values: VehicleFormValues): string[] => {
  const result = schema.safeParse(values);
  return result.success ? [] : invalidFields(result.error).sort();
};

describe("the plate (V2-30)", () => {
  it("is read however it is typed and kept in the one form", () => {
    for (const typed of ["34 ABC 123", "34abc123", "34-abc-123", " 34  Abc 123 "]) expect(normalizePlate(typed)).toBe("34 ABC 123");
  });

  it("refuses what cannot be a Turkish plate", () => {
    for (const typed of ["00 ABC 123", "82 ABC 123", "34 ABCD 123", "34 ABC 1", "34 QWX 123", "34 ÇAB 123", "ABC 123", ""]) expect(normalizePlate(typed)).toBeNull();
  });
});

describe("the form of a car", () => {
  it("accepts a good car, and names every field that is wrong", () => {
    expect(fieldsOf(valid())).toEqual([]);
    expect(fieldsOf(EMPTY_VEHICLE_FORM)).toEqual(["branchId", "modelSlug", "plate"]);
    expect(fieldsOf(valid({ year: "2014" }))).toEqual(["year"]);
    expect(fieldsOf(valid({ year: String(maxYear() + 1) }))).toEqual(["year"]);
    expect(fieldsOf(valid({ year: String(maxYear()) }))).toEqual([]);
  });

  it("makes the API's bodies: the plate in its stored form, the year a number, and a move that names only the branch", () => {
    expect(toCreateBody(valid())).toEqual({ plate: "34 ABC 123", year: 2025, modelSlug: "renault-clio", branchId: "istanbul-kadikoy" });
    expect(toMoveBody("ankara-esenboga", "v1")).toEqual({ updatedAt: "v1", branchId: "ankara-esenboga" });
  });
});

describe("the sample cars", () => {
  it("start as one car for each model at each branch that stocks it, with a good plate each", () => {
    const list = listMockVehicles("unit-vehicles-seed", everyList);
    expect(list.total).toBeGreaterThan(30);
    expect(list.items.every((row) => normalizePlate(row.plate) === row.plate && row.status === "ACTIVE")).toBe(true);
    expect(new Set(list.items.map((row) => row.plate)).size).toBe(list.total);
  });

  it("a new car is free to rent at its branch at once, and one that is switched off is not", () => {
    const world = "unit-vehicles-new";
    const before = mockVehicles(world, "TRY").length;
    const made = createMockVehicle(world, { plate: "16 ZZZ 777", year: 2026, modelSlug: "renault-clio", branchId: "bursa-nilufer" });
    expect(made.status).toBe("ok");
    expect(mockVehicles(world, "TRY").some((car) => car.modelSlug === "renault-clio" && car.branchId === "bursa-nilufer")).toBe(true);
    expect(mockVehicles(world, "TRY").length).toBe(before + 1);
    if (made.status !== "ok") return;
    const off = updateMockVehicle(world, made.value.id, { updatedAt: made.value.updatedAt, active: false });
    expect(off.status).toBe("ok");
    expect(mockVehicles(world, "TRY").some((car) => car.modelSlug === "renault-clio" && car.branchId === "bursa-nilufer")).toBe(false);
  });

  it("a plate is used once, whatever way it is typed, and a car needs a model that is on the site and a branch that is open", () => {
    const world = "unit-vehicles-rules";
    const first = listMockVehicles(world, everyList).items[0]!;
    expect(createMockVehicle(world, { plate: first.plate.replace(/ /g, "").toLowerCase(), year: 2026, modelSlug: "renault-clio", branchId: "ankara-esenboga" }).status).toBe("taken");
    expect(createMockVehicle(world, { plate: "06 ZZZ 778", year: 2026, modelSlug: "yok", branchId: "yok" })).toEqual({ status: "invalid", fields: { modelSlug: "UNKNOWN_REFERENCE", branchId: "UNKNOWN_REFERENCE" } });
    expect(createMockVehicle(world, { plate: "BAD", year: 1999, modelSlug: "renault-clio", branchId: "ankara-esenboga" })).toEqual({ status: "invalid", fields: { plate: "INVALID_FORMAT", year: "OUT_OF_RANGE" } });
  });

  it("a car with a booking to come cannot be moved or switched off, and says how many; a change needs the version it was made against", () => {
    const world = "unit-vehicles-busy";
    // The sample Clio booking picks up at Ankara, where no sample Clio is: one is added there and, being the first, carries it.
    const added = createMockVehicle(world, { plate: "06 ZZZ 700", year: 2026, modelSlug: "renault-clio", branchId: "ankara-esenboga" });
    if (added.status !== "ok") throw new Error("the car was not added");
    const clio = added.value;
    expect(getMockVehicle(world, clio.id)?.usage.reservations).toBeGreaterThan(0);
    expect(updateMockVehicle(world, clio.id, { updatedAt: clio.updatedAt, active: false }).status).toBe("in_use");
    expect(updateMockVehicle(world, clio.id, { updatedAt: clio.updatedAt, branchId: "bursa-nilufer" }).status).toBe("in_use");
    expect(updateMockVehicle(world, clio.id, { updatedAt: "old", active: false }).status).toBe("stale");
    expect(updateMockVehicle(world, "yok", { updatedAt: "x", active: false }).status).toBe("not_found");

    const free = listMockVehicles(world, { ...everyList, model: "fiat-egea", branch: "istanbul-kadikoy" }).items[0]!;
    const moved = updateMockVehicle(world, free.id, { updatedAt: free.updatedAt, branchId: "ankara-esenboga" });
    expect(moved.status).toBe("ok");
    if (moved.status === "ok") expect(moved.value.branch.id).toBe("ankara-esenboga");
  });

  it("retiring a model switches its cars off, and they cannot be switched on while the model is retired", () => {
    const world = "unit-vehicles-retire";
    const car = listMockVehicles(world, { ...everyList, model: "fiat-egea" }).items[0]!;
    expect(retireMockModel(world, "fiat-egea").status).toBe("ok");
    const after = getMockVehicle(world, car.id)!;
    expect(after.status).toBe("INACTIVE");
    expect(updateMockVehicle(world, car.id, { updatedAt: after.updatedAt, active: true })).toEqual({ status: "invalid", fields: { active: "NOT_ALLOWED" } });
  });

  it("narrows by state, model and branch, and finds a plate typed without its spaces", () => {
    const world = "unit-vehicles-filter";
    const one = listMockVehicles(world, everyList).items[0]!;
    expect(listMockVehicles(world, { ...everyList, q: one.plate.replace(/ /g, "").toLowerCase() }).items.map((row) => row.id)).toContain(one.id);
    expect(listMockVehicles(world, { ...everyList, status: "INACTIVE" }).total).toBe(0);
    expect(listMockVehicles(world, { ...everyList, model: "fiat-egea" }).items.every((row) => row.model.slug === "fiat-egea")).toBe(true);
    expect(listMockVehicles(world, { ...everyList, branch: "istanbul-kadikoy" }).items.every((row) => row.branch.id === "istanbul-kadikoy")).toBe(true);
  });
});

describe("the extra services", () => {
  const schemaE = extraFormSchema(codeMessages());

  it("a price is typed in lira and goes in kuruş, a thousands separator is refused, and nothing is free to be negative", () => {
    expect(extraLiraToKurus("150")).toBe(15000);
    expect(extraLiraToKurus("150,5")).toBe(15050);
    expect(extraLiraToKurus("0")).toBe(0);
    expect(extraLiraToKurus("1.500")).toBeNull();
    expect(extraLiraToKurus("10001")).toBeNull();
    expect(schemaE.safeParse({ nameTr: "", nameEn: "x", price: "abc" }).success).toBe(false);
  });

  it("sends only what changed", () => {
    const initial = { nameTr: "Çocuk koltuğu", nameEn: "Child seat", price: "100" };
    expect(toExtraBody(initial, initial, "v1")).toEqual({ updatedAt: "v1" });
    expect(toExtraBody({ ...initial, price: "120,50" }, initial, "v1")).toEqual({ updatedAt: "v1", price: 12050 });
    expect(toExtraBody({ ...initial, nameEn: "Baby seat" }, initial, "v1")).toEqual({ updatedAt: "v1", name: { tr: "Çocuk koltuğu", en: "Baby seat" } });
  });

  it("a new price is on the booking pages at once, and a change needs the version it was made against", () => {
    const world = "unit-extras";
    const before = getMockExtra(world, "child-seat")!;
    expect(updateMockExtra(world, "child-seat", { updatedAt: "old", price: 1 }).status).toBe("stale");
    expect(updateMockExtra(world, "child-seat", { updatedAt: before.updatedAt, price: 12500 }).status).toBe("ok");
    expect(mockExtras(world, "TRY").find((extra) => extra.slug === "child-seat")?.price.amount).toBe(12500);
    // The shared world is not touched.
    expect(mockExtras("main", "TRY").find((extra) => extra.slug === "child-seat")?.price.amount).toBe(10000);
    expect(listMockExtras(world).map((extra) => extra.price)).toEqual([...listMockExtras(world).map((extra) => extra.price)].sort((a, b) => a - b));
    expect(updateMockExtra(world, "yok", { updatedAt: "x" }).status).toBe("not_found");
  });
});
