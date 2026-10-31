import { describe, expect, it } from "vitest";
import {
  contractFormSchema,
  contractFormValuesOf,
  EMPTY_CONTRACT_FORM,
  EMPTY_READING_FORM,
  EMPTY_VEHICLE_FORM,
  feeToKurus,
  isDay,
  kurusToFee,
  readingFormSchema,
  toCreateBody,
  toReadingBody,
  toUpdateBody,
  toVehicleBody,
  vehicleFormSchema,
  type ContractFormValues,
  type VehicleFormValues,
} from "@/lib/admin-contracts";
import { codeMessages, invalidFields } from "@/lib/validation";
import { addMockReading, createMockCar, createMockContract, getMockContract, listMockContracts, returnMockCar, updateMockContract } from "@/mocks/admin-contracts";
import { en, tr } from "../i18n/messages";

const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const ANADOLU = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";

describe("the fee (V2-35)", () => {
  it("is typed in lira and travels in kuruş, with one or two decimals and no thousands separator", () => {
    expect(feeToKurus("45000")).toBe(4_500_000);
    expect(feeToKurus("45000,50")).toBe(4_500_050);
    expect(feeToKurus(" 1250.5 ")).toBe(125_050);
    for (const bad of ["", "0", "0,00", "45.000", "45 000", "-5", "abc", "1,234", "123456789", "100000000"]) expect(feeToKurus(bad), bad).toBeNull();
    // 99.999.999,99 is the most a month can be, as the API's limit.
    expect(feeToKurus("99999999,99")).toBe(9_999_999_999);
  });

  it("is read back the way it was typed", () => {
    expect(kurusToFee(4_500_000)).toBe("45000");
    expect(kurusToFee(4_500_050)).toBe("45000,50");
    expect(kurusToFee(100)).toBe("1");
    expect(kurusToFee(5)).toBe("0,05");
  });

  it("a day is a real calendar day", () => {
    expect(isDay("2026-10-31")).toBe(true);
    for (const bad of ["2026-02-30", "2026-13-01", "31-10-2026", "", "2026-1-1", "1999-12-31"]) expect(isDay(bad), bad).toBe(false);
  });
});

describe("the contract form", () => {
  const schema = contractFormSchema(codeMessages());
  const valid = (overrides: Partial<ContractFormValues> = {}): ContractFormValues => ({ ...EMPTY_CONTRACT_FORM, startAt: "2026-11-01", endAt: "2027-10-31", monthlyFee: "45000", deliveryCity: "İzmir", ...overrides });
  const fieldsOf = (values: ContractFormValues): string[] => {
    const result = schema.safeParse(values);
    return result.success ? [] : invalidFields(result.error).sort();
  };

  it("needs a product from the list, two days with the end after the start, a fee and a city from the list", () => {
    expect(fieldsOf(valid())).toEqual([]);
    expect(fieldsOf(EMPTY_CONTRACT_FORM)).toEqual(["deliveryCity", "endAt", "monthlyFee", "startAt"]);
    expect(fieldsOf(valid({ productSlug: "baska" }))).toEqual(["productSlug"]);
    expect(fieldsOf(valid({ endAt: "2026-11-01" }))).toEqual(["endAt"]);
    expect(fieldsOf(valid({ endAt: "2026-10-01" }))).toEqual(["endAt"]);
    expect(fieldsOf(valid({ monthlyFee: "45.000" }))).toEqual(["monthlyFee"]);
    expect(fieldsOf(valid({ deliveryCity: "Atlantis" }))).toEqual(["deliveryCity"]);
  });

  it("a new contract sends the fee in kuruş", () => {
    expect(toCreateBody(valid({ monthlyFee: "45000,50" }))).toEqual({ productSlug: "akilli-kurumsal-filo", startAt: "2026-11-01", endAt: "2027-10-31", monthlyFee: 4_500_050, deliveryCity: "İzmir" });
  });

  it("a change sends only what changed and the version; the product and the start do not go", () => {
    const initial = valid({ monthlyFee: "45000" });
    expect(toUpdateBody(initial, initial, "v1")).toEqual({ updatedAt: "v1" });
    expect(toUpdateBody({ ...initial, monthlyFee: "46000" }, initial, "v1")).toEqual({ updatedAt: "v1", monthlyFee: 4_600_000 });
    expect(toUpdateBody({ ...initial, endAt: "2027-12-31", status: "ENDED", deliveryCity: "Ankara" }, initial, "v1")).toEqual({ updatedAt: "v1", endAt: "2027-12-31", deliveryCity: "Ankara", status: "ENDED" });
    expect(toUpdateBody({ ...initial, productSlug: "yesil-filo", startAt: "2020-01-01" }, initial, "v1")).toEqual({ updatedAt: "v1" });
  });

  it("opens with what is stored", () => {
    const contract = getMockContract("unit-form", listMockContracts("unit-form", EGE)![0]!.number)!;
    expect(contractFormValuesOf(contract)).toMatchObject({ productSlug: "akilli-kurumsal-filo", monthlyFee: "64000", deliveryCity: "İzmir", status: "ACTIVE" });
  });
});

describe("the car form", () => {
  const schema = vehicleFormSchema(codeMessages(), () => new Date("2026-10-31T00:00:00Z"));
  const valid = (overrides: Partial<VehicleFormValues> = {}): VehicleFormValues => ({ ...EMPTY_VEHICLE_FORM, modelSlug: "fiat-egea", plate: "35abc123", year: "2025", startKm: "1200", ...overrides });
  const fieldsOf = (values: VehicleFormValues): string[] => {
    const result = schema.safeParse(values);
    return result.success ? [] : invalidFields(result.error).sort();
  };

  it("takes a plate however it is typed, a year up to next year, a kilometre, and two days that may be left out", () => {
    expect(fieldsOf(valid())).toEqual([]);
    expect(fieldsOf(EMPTY_VEHICLE_FORM)).toEqual(["modelSlug", "plate", "startKm", "year"]);
    expect(fieldsOf(valid({ plate: "abc" }))).toEqual(["plate"]);
    expect(fieldsOf(valid({ year: "1999" }))).toEqual(["year"]);
    expect(fieldsOf(valid({ year: "2027" }))).toEqual([]);
    expect(fieldsOf(valid({ year: "2028" }))).toEqual(["year"]);
    expect(fieldsOf(valid({ startKm: "-1" }))).toEqual(["startKm"]);
    expect(fieldsOf(valid({ startKm: "2000001" }))).toEqual(["startKm"]);
    expect(fieldsOf(valid({ nextMaintenanceOn: "2026-02-30", inspectionDueOn: "x" }))).toEqual(["inspectionDueOn", "nextMaintenanceOn"]);
    expect(fieldsOf(valid({ nextMaintenanceOn: "2026-12-01", inspectionDueOn: "2027-05-01" }))).toEqual([]);
  });

  it("sends the plate in its one form and leaves an empty day out", () => {
    expect(toVehicleBody(valid())).toEqual({ modelSlug: "fiat-egea", plate: "35 ABC 123", year: 2025, startKm: 1200 });
    expect(toVehicleBody(valid({ nextMaintenanceOn: "2026-12-01" })).nextMaintenanceOn).toBe("2026-12-01");
  });
});

describe("the reading form", () => {
  const schema = readingFormSchema(codeMessages());
  const fieldsOf = (values: object): string[] => {
    const result = schema.safeParse(values);
    return result.success ? [] : invalidFields(result.error).sort();
  };

  it("needs a kilometre, and takes percentages of 0 to 100 that may be left out", () => {
    expect(fieldsOf(EMPTY_READING_FORM)).toEqual(["km"]);
    expect(fieldsOf({ ...EMPTY_READING_FORM, km: "1200" })).toEqual([]);
    expect(fieldsOf({ ...EMPTY_READING_FORM, km: "1200", fuelPercent: "101", chargePercent: "-1", batteryHealthPercent: "x" })).toEqual(["batteryHealthPercent", "chargePercent", "fuelPercent"]);
    expect(fieldsOf({ ...EMPTY_READING_FORM, km: "1,5" })).toEqual(["km"]);
  });

  it("sends only what was filled", () => {
    expect(toReadingBody({ ...EMPTY_READING_FORM, km: "1200" })).toEqual({ km: 1200 });
    expect(toReadingBody({ km: "1200", fuelPercent: "60", chargePercent: "", batteryHealthPercent: "97" })).toEqual({ km: 1200, fuelPercent: 60, batteryHealthPercent: 97 });
  });
});

describe("the sample contracts", () => {
  const form = (overrides: Partial<ContractFormValues> = {}): ContractFormValues => ({ ...EMPTY_CONTRACT_FORM, startAt: "2026-11-01", endAt: "2027-10-31", monthlyFee: "30000", deliveryCity: "Ankara", ...overrides });
  const car = (overrides: Partial<VehicleFormValues> = {}): VehicleFormValues => ({ ...EMPTY_VEHICLE_FORM, modelSlug: "renault-clio", plate: "06 TST 901", year: "2025", startKm: "500", ...overrides });

  it("lists the company's contract with its cars, and one that has none is empty; a company that is not there is null", () => {
    const list = listMockContracts("unit-list", EGE)!;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ productSlug: "akilli-kurumsal-filo", status: "ACTIVE", vehicleCount: 2, company: { name: "Ege Lojistik A.Ş." } });
    const detail = getMockContract("unit-list", list[0]!.number.toLowerCase())!;
    expect(detail.vehicles.map((row) => row.plate)).toEqual(["35 FLM 101", "35 FLM 102"]);
    expect(detail.vehicles[0]).toMatchObject({ lastKm: 20_100, assignee: { name: "Ayşe Demir" } });
    expect(listMockContracts("unit-list", ANADOLU)).toEqual([]);
    expect(listMockContracts("unit-list", "yok")).toBeNull();
    expect(getMockContract("unit-list", "SZL-2099-99999")).toBeNull();
  });

  it("numbers the contracts one after the other, in a world of their own", () => {
    const world = "unit-number";
    const first = createMockContract(world, ANADOLU, form());
    const second = createMockContract(world, ANADOLU, form({ productSlug: "yesil-filo" }));
    expect(first.status === "ok" && second.status === "ok").toBe(true);
    if (first.status === "ok" && second.status === "ok") {
      expect(first.value.number).toMatch(/^SZL-\d{4}-00002$/);
      expect(second.value.number).toMatch(/^SZL-\d{4}-00003$/);
      expect(first.value).toMatchObject({ monthlyFee: 3_000_000, vehicleCount: 0, status: "ACTIVE" });
    }
    expect(listMockContracts("unit-number-other", ANADOLU)).toEqual([]);
    expect(createMockContract(world, "yok", form())).toEqual({ status: "not_found" });
  });

  it("a car takes a plate once, whether or not it is typed the same; a contract that has ended takes none", () => {
    const world = "unit-car";
    const number = listMockContracts(world, EGE)![0]!.number;
    const added = createMockCar(world, number, car());
    expect(added.status).toBe("ok");
    if (added.status === "ok") expect(added.value).toMatchObject({ plate: "06 TST 901", model: { brand: "Renault", model: "Clio" }, lastKm: 500, assignee: null });
    expect(createMockCar(world, number, car({ plate: "06tst901" }))).toEqual({ status: "taken" });
    expect(createMockCar(world, number, car({ plate: "35 flm 101" }))).toEqual({ status: "taken" });
    expect(createMockCar(world, "SZL-2099-99999", car({ plate: "06 TST 902" }))).toEqual({ status: "not_found" });
  });

  it("a reading's kilometre does not go back, and a car that is given back is history", () => {
    const world = "unit-reading";
    const detail = getMockContract(world, listMockContracts(world, EGE)![0]!.number)!;
    const egea = detail.vehicles.find((row) => row.plate === "35 FLM 101")!;
    expect(addMockReading(world, egea.id, { km: "20099", fuelPercent: "", chargePercent: "", batteryHealthPercent: "" })).toEqual({ status: "invalid", fields: { km: "OUT_OF_RANGE" } });
    const read = addMockReading(world, egea.id, { km: "20500", fuelPercent: "40", chargePercent: "", batteryHealthPercent: "" });
    expect(read.status).toBe("ok");
    expect(getMockContract(world, detail.number)!.vehicles.find((row) => row.id === egea.id)!.lastKm).toBe(20_500);

    const given = returnMockCar(world, egea.id, egea.updatedAt);
    expect(given.status).toBe("ok");
    if (given.status === "ok") expect(given.value).toMatchObject({ status: "RETURNED", assignee: null });
    expect(returnMockCar(world, egea.id, egea.updatedAt).status).toBe("stale");
    const returned = getMockContract(world, detail.number)!.vehicles.find((row) => row.id === egea.id)!;
    expect(returnMockCar(world, egea.id, returned.updatedAt)).toEqual({ status: "not_allowed" });
    expect(addMockReading(world, egea.id, { km: "30000", fuelPercent: "", chargePercent: "", batteryHealthPercent: "" })).toEqual({ status: "not_allowed" });
    expect(returnMockCar(world, "yok", returned.updatedAt)).toEqual({ status: "not_found" });
  });

  it("a contract with cars still in use is not ended; after they are given back it is, and takes no car", () => {
    const world = "unit-end";
    const detail = getMockContract(world, listMockContracts(world, EGE)![0]!.number)!;
    const asked = (): ContractFormValues => ({ productSlug: detail.productSlug, startAt: detail.startAt, endAt: detail.endAt, monthlyFee: "64000", deliveryCity: detail.deliveryCity, status: "ENDED" });
    expect(updateMockContract(world, detail.number, "2000-01-01T00:00:00.000Z", asked())).toEqual({ status: "stale" });
    expect(updateMockContract(world, detail.number, detail.updatedAt, asked())).toEqual({ status: "in_use", vehicles: 2 });
    expect(updateMockContract(world, detail.number, detail.updatedAt, { ...asked(), status: "ACTIVE", endAt: detail.startAt })).toEqual({ status: "invalid", fields: { endAt: "INVALID_DATE_RANGE" } });

    for (const vehicle of detail.vehicles) expect(returnMockCar(world, vehicle.id, vehicle.updatedAt).status).toBe("ok");
    const ended = updateMockContract(world, detail.number, detail.updatedAt, asked());
    expect(ended.status).toBe("ok");
    if (ended.status === "ok") expect(ended.value).toMatchObject({ status: "ENDED", remainingDays: 0, vehicleCount: 0 });
    expect(createMockCar(world, detail.number, car({ plate: "06 TST 903" }))).toEqual({ status: "not_allowed" });
  });
});

describe("the messages", () => {
  it("every product, status and car state has a name in both languages", () => {
    for (const messages of [tr, en]) {
      for (const slug of ["akilli-kurumsal-filo", "yesil-filo", "vip-mobilite", "esnek-kisa-donem"] as const) expect(messages.Admin.contracts.products[slug], slug).toBeTruthy();
      expect(messages.Admin.contracts.status.ACTIVE).toBeTruthy();
      expect(messages.Admin.contracts.status.ENDED).toBeTruthy();
      expect(messages.Admin.contracts.vehicle.giveBackFor).toContain("{plate}");
    }
  });
});
