import { describe, expect, it } from "vitest";
import {
  dayAfter,
  dayStart,
  EMPTY_PROMO_FORM,
  formValuesOf,
  istanbulDay,
  lastDay,
  promoFormSchema,
  toCreateBody,
  toUpdateBody,
  type PromoCode,
  type PromoFormValues,
} from "@/lib/admin-promo";
import { codeMessages, invalidFields } from "@/lib/validation";
import { createMockPromoCode, deleteMockPromoCode, getMockPromoCode, listMockPromoCodes, mockPromoPercent, updateMockPromoCode } from "@/mocks/promo-codes";

const schema = promoFormSchema(codeMessages());
const form = (overrides: Partial<PromoFormValues> = {}): PromoFormValues => ({ ...EMPTY_PROMO_FORM, code: "YAZ25", percent: "25", ...overrides });
const fieldsOf = (values: PromoFormValues): string[] => {
  const result = schema.safeParse(values);
  return result.success ? [] : invalidFields(result.error).sort();
};

describe("days in Istanbul time (V2-26)", () => {
  it("a day starts at 00:00 Istanbul, which is 21:00 the evening before in UTC", () => {
    expect(dayStart("2026-10-29")).toBe("2026-10-28T21:00:00.000Z");
    expect(dayAfter("2026-10-29")).toBe("2026-10-29T21:00:00.000Z");
  });

  it("names the Istanbul day of an instant, not the UTC one", () => {
    expect(istanbulDay("2026-10-28T21:00:00.000Z")).toBe("2026-10-29");
    expect(istanbulDay("2026-10-28T20:59:59.999Z")).toBe("2026-10-28");
  });

  it("the last day of a code is the day before its end instant, so the day chosen is the day shown", () => {
    for (const day of ["2026-10-29", "2026-12-31", "2027-03-01"]) expect(lastDay(dayAfter(day))).toBe(day);
  });
});

describe("the code form (V2-26)", () => {
  it("accepts a plain code with only the required fields", () => {
    expect(fieldsOf(form())).toEqual([]);
  });

  it("reads the code the way the booking form does: spaces and case do not matter", () => {
    expect(fieldsOf(form({ code: " yaz 25 " }))).toEqual([]);
    expect(toCreateBody(form({ code: " yaz 25 " })).code).toBe("YAZ25");
  });

  it("rejects what cannot be a code", () => {
    for (const code of ["", "ab", "a".repeat(21), "YAZ-25", "YAZ<25>"]) expect(fieldsOf(form({ code })), code).toEqual(["code"]);
  });

  it("the percent is a whole number from 1 to 90", () => {
    for (const percent of ["", "0", "91", "100", "9a", "2.5", "-5"]) expect(fieldsOf(form({ percent })), percent).toEqual(["percent"]);
    for (const percent of ["1", "10", "90"]) expect(fieldsOf(form({ percent })), percent).toEqual([]);
  });

  it("the last day may be the first day, but not before it", () => {
    expect(fieldsOf(form({ validFrom: "2026-11-01", validUntil: "2026-11-01" }))).toEqual([]);
    expect(fieldsOf(form({ validFrom: "2026-11-02", validUntil: "2026-11-01" }))).toEqual(["validUntil"]);
    expect(fieldsOf(form({ validUntil: "2026-11-01" }))).toEqual([]);
  });

  it("a day has to be a real day", () => {
    expect(fieldsOf(form({ validFrom: "2026-13-40" }))).toEqual(["validFrom"]);
    expect(fieldsOf(form({ validUntil: "yarın" }))).toEqual(["validUntil"]);
  });

  it("the limit is empty or a whole number of 1 or more", () => {
    expect(fieldsOf(form({ maxRedemptions: "" }))).toEqual([]);
    expect(fieldsOf(form({ maxRedemptions: "500" }))).toEqual([]);
    for (const maxRedemptions of ["0", "-1", "1.5", "many"]) expect(fieldsOf(form({ maxRedemptions }))).toEqual(["maxRedemptions"]);
  });
});

describe("what is sent to the API (V2-26)", () => {
  it("a new code: days become instants, empty means none", () => {
    expect(toCreateBody(form({ validFrom: "2026-11-01", validUntil: "2026-11-30", maxRedemptions: "50", oncePerUser: false }))).toEqual({
      code: "YAZ25",
      percent: 25,
      active: true,
      validFrom: "2026-10-31T21:00:00.000Z",
      validUntil: "2026-11-30T21:00:00.000Z",
      maxRedemptions: 50,
      oncePerUser: false,
    });
    expect(toCreateBody(form())).toMatchObject({ validFrom: null, validUntil: null, maxRedemptions: null });
  });

  const row: PromoCode = {
    code: "YAZ25",
    percent: 25,
    active: true,
    validFrom: "2026-10-31T21:00:00.000Z",
    // Not at a day's start: made by another route, with a time in it.
    validUntil: "2026-11-30T14:30:00.000Z",
    maxRedemptions: 50,
    oncePerUser: true,
    used: 3,
    deletable: false,
    status: "ACTIVE",
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-20T09:00:00.000Z",
  };

  it("a change sends only what changed, with the version it was made against", () => {
    const initial = formValuesOf(row);
    expect(toUpdateBody({ ...initial, percent: "30" }, initial, row.updatedAt)).toEqual({ updatedAt: row.updatedAt, percent: 30 });
    expect(toUpdateBody(initial, initial, row.updatedAt)).toEqual({ updatedAt: row.updatedAt });
  });

  it("an exact time the form cannot show is not rounded to a day by changing something else", () => {
    const initial = formValuesOf(row);
    const body = toUpdateBody({ ...initial, active: false }, initial, row.updatedAt);
    expect(body).toEqual({ updatedAt: row.updatedAt, active: false });
    expect(body).not.toHaveProperty("validUntil");
  });

  it("clearing a field sends null, which means none", () => {
    const initial = formValuesOf(row);
    expect(toUpdateBody({ ...initial, validUntil: "", maxRedemptions: "" }, initial, row.updatedAt)).toEqual({
      updatedAt: row.updatedAt,
      validUntil: null,
      maxRedemptions: null,
    });
  });

  it("the form opens on the days the stored instants mean", () => {
    expect(formValuesOf({ ...row, validUntil: dayAfter("2026-11-30") })).toMatchObject({ validFrom: "2026-11-01", validUntil: "2026-11-30" });
    expect(formValuesOf({ ...row, validFrom: null, validUntil: null, maxRedemptions: null })).toMatchObject({ validFrom: "", validUntil: "", maxRedemptions: "" });
  });
});

// The sample mode behaves like the API (mocks/promo-codes.ts), because the panel and the e2e tests are walked on it.
describe("the sample code store", () => {
  const unique = (suffix: string) => "UT" + Math.random().toString(36).slice(2, 8).toUpperCase() + suffix;

  it("a code made in the panel works at once, and stops working when it is switched off", () => {
    const code = unique("A");
    const created = createMockPromoCode({ code, percent: 15 });
    expect(created.status).toBe("ok");
    expect(mockPromoPercent(code)).toBe(15);
    const version = (created as { value: PromoCode }).value.updatedAt;
    const off = updateMockPromoCode(code, { updatedAt: version, active: false });
    expect(off.status).toBe("ok");
    expect(mockPromoPercent(code)).toBeNull();
  });

  it("the sample codes of the booking summary are in the store", () => {
    expect(mockPromoPercent("NOVERA10")).toBe(10);
    expect(mockPromoPercent("HOSGELDIN")).toBe(5);
    expect(mockPromoPercent("NOPE")).toBeNull();
    // Expired, switched off, used up and not started do not take anything off.
    for (const code of ["KIS24", "KAPALI15", "ILK5", "YAKINDA12"]) expect(mockPromoPercent(code), code).toBeNull();
  });

  it("a name that is taken is refused, and a period that ends before it starts", () => {
    expect(createMockPromoCode({ code: "NOVERA10", percent: 5 }).status).toBe("taken");
    const bad = createMockPromoCode({ code: unique("B"), percent: 5, validFrom: "2026-11-02T00:00:00.000Z", validUntil: "2026-11-01T00:00:00.000Z" });
    expect(bad).toEqual({ status: "invalid", fields: { validUntil: "INVALID_DATE_RANGE" } });
  });

  it("an edit made against an old version is refused and changes nothing", () => {
    const code = unique("C");
    const created = createMockPromoCode({ code, percent: 10 }) as { value: PromoCode };
    updateMockPromoCode(code, { updatedAt: created.value.updatedAt, percent: 20 });
    expect(updateMockPromoCode(code, { updatedAt: created.value.updatedAt, percent: 30 }).status).toBe("stale");
    expect(getMockPromoCode(code)?.percent).toBe(20);
  });

  it("the limit cannot go below the uses so far", () => {
    const current = getMockPromoCode("NOVERA10")!;
    expect(current.used).toBeGreaterThan(1);
    expect(updateMockPromoCode("NOVERA10", { updatedAt: current.updatedAt, maxRedemptions: 1 })).toEqual({
      status: "invalid",
      fields: { maxRedemptions: "BELOW_USAGE" },
    });
  });

  it("a code that was used is not deleted; one that was not is", () => {
    expect(deleteMockPromoCode("NOVERA10").status).toBe("in_use");
    expect(getMockPromoCode("NOVERA10")).not.toBeNull();
    const code = unique("D");
    createMockPromoCode({ code, percent: 10 });
    expect(deleteMockPromoCode(code).status).toBe("ok");
    expect(getMockPromoCode(code)).toBeNull();
    expect(deleteMockPromoCode(code).status).toBe("not_found");
  });

  it("lists, narrows, searches and pages like the API", () => {
    const base = { page: 1, pageSize: 20, sort: { key: "code", dir: "asc" as const }, q: "", status: null };
    const all = listMockPromoCodes(base);
    expect(all.total).toBeGreaterThanOrEqual(6);
    expect(all.items.map((row) => row.code)).toEqual([...all.items.map((row) => row.code)].sort());
    expect(listMockPromoCodes({ ...base, status: "EXPIRED" }).items.map((row) => row.code)).toContain("KIS24");
    expect(listMockPromoCodes({ ...base, q: "novera" }).items.map((row) => row.code)).toEqual(["NOVERA10"]);
    expect(listMockPromoCodes({ ...base, pageSize: 2 })).toMatchObject({ page: 1, pageSize: 2, total: all.total });
    expect(listMockPromoCodes({ ...base, pageSize: 2 }).items).toHaveLength(2);
  });
});
