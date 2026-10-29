import { describe, expect, it } from "vitest";
import {
  consumptionUnitOf,
  EMPTY_MODEL_FORM,
  formValuesOf,
  kurusToLira,
  liraToKurus,
  modelFormSchema,
  parseConsumption,
  suggestSlug,
  toCreateBody,
  toUpdateBody,
  type ModelFormValues,
} from "@/lib/admin-models";
import { codeMessages, invalidFields } from "@/lib/validation";
import {
  carsAtBranch,
  createMockModel,
  getMockModel,
  listMockModels,
  mockAvailable,
  mockVehicles,
  restoreMockModel,
  retireMockModel,
  updateMockModel,
} from "@/mocks/models";

// The sample store is kept per world (lib/mock-world.ts); the tests have one of their own.
const W = "unit-tests-models";
const schema = modelFormSchema(codeMessages());
const valid = (overrides: Partial<ModelFormValues> = {}): ModelFormValues => ({
  ...EMPTY_MODEL_FORM,
  brand: "Škoda",
  model: "Fabia",
  classSlug: "economy",
  consumption: "5,2",
  dailyPrice: "1250,50",
  descriptionTr: "Şehir içi için küçük ve ekonomik.",
  descriptionEn: "Small and economical for the city.",
  ...overrides,
});
const fieldsOf = (values: ModelFormValues): string[] => {
  const result = schema.safeParse(values);
  return result.success ? [] : invalidFields(result.error).sort();
};
const everyList = { page: 1, pageSize: 100, sort: null, q: "", classSlug: null, fuel: null, status: null };

describe("money and consumption typed into the form (V2-29)", () => {
  it("lira go to kuruş with a comma or a dot, and a thousands separator is refused", () => {
    expect(liraToKurus("1250")).toBe(125000);
    expect(liraToKurus("1250,5")).toBe(125050);
    expect(liraToKurus("1250.50")).toBe(125050);
    expect(liraToKurus("1.250")).toBeNull();
    expect(liraToKurus("0")).toBeNull();
    expect(liraToKurus("abc")).toBeNull();
    expect(liraToKurus("100001")).toBeNull();
  });

  it("kuruş come back as the text that was typed", () => {
    expect(kurusToLira(125000)).toBe("1250");
    expect(kurusToLira(125050)).toBe("1250,50");
    expect(kurusToLira(100005)).toBe("1000,05");
  });

  it("a consumption is above 0 and at most 100", () => {
    expect(parseConsumption("5,6")).toBe(5.6);
    expect(parseConsumption("0")).toBeNull();
    expect(parseConsumption("101")).toBeNull();
    expect(parseConsumption("")).toBeNull();
  });

  it("the unit follows the fuel", () => {
    expect(consumptionUnitOf("ELECTRIC")).toBe("KWH_PER_100KM");
    expect(consumptionUnitOf("DIESEL")).toBe("L_PER_100KM");
  });
});

describe("the address of a model", () => {
  it("is made from the name without Turkish letters", () => {
    expect(suggestSlug("Renault", "Clio")).toBe("renault-clio");
    expect(suggestSlug("Škoda", "Çelik Şahin!")).toBe("skoda-celik-sahin");
  });
});

describe("the form", () => {
  it("accepts a complete model", () => {
    expect(fieldsOf(valid())).toEqual([]);
  });

  it("names every field that is wrong", () => {
    expect(fieldsOf(EMPTY_MODEL_FORM)).toEqual(["brand", "classSlug", "consumption", "dailyPrice", "descriptionEn", "descriptionTr", "model"]);
    expect(fieldsOf(valid({ seats: "10", bags: "11", slug: "A B" }))).toEqual(["bags", "seats", "slug"]);
    expect(fieldsOf(valid({ dailyPrice: "1.250" }))).toEqual(["dailyPrice"]);
  });

  it("makes the API's body: the address only when typed, kuruş, and a null picture when there is none", () => {
    const body = toCreateBody(valid());
    expect(body).toMatchObject({ brand: "Škoda", model: "Fabia", classSlug: "economy", seats: 5, bags: 2, consumption: 5.2, dailyPrice: 125050, imageUrl: null });
    expect("slug" in body).toBe(false);
    expect(toCreateBody(valid({ slug: "skoda-fabia" })).slug).toBe("skoda-fabia");
  });

  it("sends only what changed, with the version", () => {
    const initial = valid();
    expect(toUpdateBody(initial, initial, "v1")).toEqual({ updatedAt: "v1" });
    expect(toUpdateBody(valid({ dailyPrice: "1300" }), initial, "v1")).toEqual({ updatedAt: "v1", dailyPrice: 130000 });
    // Between an electric car and another, the unit changes, so the consumption is sent again.
    expect(toUpdateBody(valid({ fuelType: "ELECTRIC" }), initial, "v1")).toMatchObject({ fuelType: "ELECTRIC", consumption: 5.2 });
    expect(toUpdateBody(valid({ imageUrl: "/fleet/x.webp" }), initial, "v1")).toEqual({ updatedAt: "v1", imageUrl: "/fleet/x.webp" });
  });
});

describe("the sample models", () => {
  it("start as the 15 of the fleet page, each in its branches", () => {
    const list = listMockModels(W + "-seed", everyList);
    expect(list.total).toBe(15);
    expect(list.items.every((row) => row.status === "ACTIVE")).toBe(true);
    expect(mockVehicles(W + "-seed", "TRY").length).toBeGreaterThan(15);
    expect(carsAtBranch(W + "-seed", "istanbul-kadikoy")).toBeGreaterThan(0);
  });

  it("a new model is listed and on the fleet page at once, but in no search because it has no cars", () => {
    const world = W + "-new";
    const made = createMockModel(world, { ...toCreateBody(valid()), imageUrl: null });
    expect(made.status).toBe("ok");
    expect(getMockModel(world, "skoda-fabia")?.activeVehicles).toBe(0);
    expect(mockVehicles(world, "TRY").some((car) => car.modelSlug === "skoda-fabia")).toBe(true);
    const search = { pickupBranchId: "istanbul-kadikoy", returnBranchId: "istanbul-kadikoy", startAt: "2027-01-10T10:00", endAt: "2027-01-12T10:00" };
    expect(mockAvailable(world, search, "TRY").some((offer) => offer.modelSlug === "skoda-fabia")).toBe(false);
    // The same address twice is refused, and a class that does not exist is a field error.
    expect(createMockModel(world, toCreateBody(valid())).status).toBe("taken");
    expect(createMockModel(world, { ...toCreateBody(valid({ model: "Scala" })), classSlug: "yok" })).toEqual({ status: "invalid", fields: { classSlug: "UNKNOWN_REFERENCE" } });
  });

  it("a change needs the version it was made against and moves the version on", () => {
    const world = W + "-edit";
    const before = getMockModel(world, "fiat-egea")!;
    expect(updateMockModel(world, "fiat-egea", { updatedAt: "old", dailyPrice: 999 }).status).toBe("stale");
    const saved = updateMockModel(world, "fiat-egea", { updatedAt: before.updatedAt, dailyPrice: 999 });
    expect(saved.status).toBe("ok");
    const after = getMockModel(world, "fiat-egea")!;
    expect(after.dailyPrice).toBe(999);
    expect(after.updatedAt).not.toBe(before.updatedAt);
    expect(updateMockModel(world, "yok-yok", { updatedAt: "x" }).status).toBe("not_found");
    // Crossing to an electric car without a consumption is refused: the unit changes with it.
    expect(updateMockModel(world, "fiat-egea", { updatedAt: after.updatedAt, fuelType: "ELECTRIC" })).toEqual({ status: "invalid", fields: { consumption: "REQUIRED" } });
  });

  it("a retired model leaves the site and the search, and restored it is back without its cars", () => {
    const world = W + "-retire";
    const made = createMockModel(world, toCreateBody(valid({ model: "Rapid" })));
    expect(made.status).toBe("ok");
    expect(retireMockModel(world, "skoda-rapid").status).toBe("ok");
    expect(getMockModel(world, "skoda-rapid")?.status).toBe("RETIRED");
    expect(mockVehicles(world, "TRY").some((car) => car.modelSlug === "skoda-rapid")).toBe(false);
    expect(restoreMockModel(world, "skoda-rapid").status).toBe("ok");
    expect(getMockModel(world, "skoda-rapid")?.status).toBe("ACTIVE");
  });

  it("a model with a booking to come refuses to be retired and says how many", () => {
    const world = W + "-busy";
    const clio = getMockModel(world, "renault-clio")!;
    expect(clio.usage.reservations).toBeGreaterThan(0);
    const refused = retireMockModel(world, "renault-clio");
    expect(refused).toEqual({ status: "in_use", usage: { reservations: clio.usage.reservations, holds: 0 } });
    expect(getMockModel(world, "renault-clio")?.status).toBe("ACTIVE");
  });

  it("filters by class, fuel and status, and searches without Turkish letters", () => {
    const world = W + "-filter";
    expect(listMockModels(world, { ...everyList, fuel: "ELECTRIC" }).items.every((row) => row.fuelType === "ELECTRIC")).toBe(true);
    expect(listMockModels(world, { ...everyList, q: "citroen" }).total).toBeLessThanOrEqual(1);
    expect(listMockModels(world, { ...everyList, status: "RETIRED" }).total).toBe(0);
    expect(formValuesOf(listMockModels(world, everyList).items[0]!).brand).not.toBe("");
  });
});
