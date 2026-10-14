import { describe, expect, it } from "vitest";
import { checkEligibility, fullYears, isIsoDate, rentalStartDate } from "@/lib/driver-eligibility";
import { MIN_AGE, requirementsFor } from "@/lib/driver-rules";
import { driverSchema } from "@/lib/driver-schema";

const names = <T extends string>(...keys: T[]) => Object.fromEntries(keys.map((key) => [key, key])) as Record<T, T>;
const issues = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((issue) => `${String(issue.path[0])}:${issue.message}`);

describe("fullYears", () => {
  it("counts the birthday itself, not the day before", () => {
    expect(fullYears("2005-03-15", "2026-03-15")).toBe(21);
    expect(fullYears("2005-03-15", "2026-03-14")).toBe(20);
  });
  it("treats 29 February as 1 March in a common year", () => {
    expect(fullYears("2000-02-29", "2021-02-28")).toBe(20);
    expect(fullYears("2000-02-29", "2021-03-01")).toBe(21);
    expect(fullYears("2000-02-29", "2024-02-29")).toBe(24);
  });
  it("is negative-safe when the date is later than the day counted to", () => {
    expect(fullYears("2030-01-01", "2026-01-01")).toBe(-4);
  });
});

describe("isIsoDate", () => {
  it("accepts real days only", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("26-01-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("rentalStartDate", () => {
  it("takes the local date of the search start", () => {
    expect(rentalStartDate("2026-12-14T10:00")).toBe("2026-12-14");
  });
});

describe("requirements", () => {
  it("is eighteen for every licence country, and the permit only for the US", () => {
    expect(MIN_AGE).toBe(18);
    expect(requirementsFor("TR")).toEqual({ minAge: 18, internationalPermit: false });
    expect(requirementsFor("DE")).toEqual({ minAge: 18, internationalPermit: false });
    expect(requirementsFor("GB")).toEqual({ minAge: 18, internationalPermit: false });
    expect(requirementsFor("US")).toEqual({ minAge: 18, internationalPermit: true });
  });
});

describe("checkEligibility", () => {
  const tr = requirementsFor("TR");
  const start = "2026-12-14";

  it("passes someone who turns 18 on the first day, whatever their years of licence", () => {
    const result = checkEligibility({ birthDate: "2008-12-14", licenceIssuedAt: "2026-12-01" }, tr, start);
    expect(result).toMatchObject({ ok: true, reasons: [], ageYears: 18 });
  });
  it("fails someone a day short of 18", () => {
    const result = checkEligibility({ birthDate: "2008-12-15", licenceIssuedAt: "2026-01-01" }, tr, start);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(["age"]);
  });
  it("treats every licence country alike for age and date", () => {
    const driver = { birthDate: "1995-05-05", licenceIssuedAt: "2023-12-01" };
    for (const country of ["TR", "DE", "GB", "US"] as const) {
      expect(checkEligibility(driver, requirementsFor(country), start).ok).toBe(true);
    }
  });
  it("counts on the rental's first day, not on today", () => {
    const driver = { birthDate: "2008-12-14", licenceIssuedAt: "2020-01-01" };
    expect(checkEligibility(driver, tr, "2026-12-13").ok).toBe(false);
    expect(checkEligibility(driver, tr, "2026-12-14").ok).toBe(true);
  });
});

describe("driverSchema", () => {
  const schema = driverSchema(
    names("birthDate", "country", "licenceNumber", "licenceIssuedAt", "licenceBeforeBirth", "permit", "declaration"),
    () => new Date("2026-10-11T12:00:00"),
  );
  const driver = {
    birthDate: "1990-04-01",
    country: "TR",
    licenceNumber: "AB123456",
    licenceIssuedAt: "2012-06-01",
    permit: false,
    declaration: true,
  };

  it("accepts a complete, valid driver", () => {
    expect(schema.safeParse(driver).success).toBe(true);
  });
  it("names what is wrong", () => {
    const bad = { ...driver, birthDate: "", country: "", licenceNumber: "a b", licenceIssuedAt: "2030-01-01", declaration: false };
    expect(issues(schema.safeParse(bad))).toEqual(
      expect.arrayContaining(["birthDate:birthDate", "country:country", "licenceNumber:licenceNumber", "licenceIssuedAt:licenceIssuedAt", "declaration:declaration"]),
    );
  });
  it("rejects a licence dated on or before the birth date", () => {
    expect(issues(schema.safeParse({ ...driver, licenceIssuedAt: "1990-04-01" }))).toContain("licenceIssuedAt:licenceBeforeBirth");
  });
  it("asks for the international permit declaration only where it is required", () => {
    expect(schema.safeParse({ ...driver, country: "DE" }).success).toBe(true);
    expect(issues(schema.safeParse({ ...driver, country: "US" }))).toContain("permit:permit");
    expect(schema.safeParse({ ...driver, country: "US", permit: true }).success).toBe(true);
  });
  it("does not accept a day that does not exist", () => {
    expect(schema.safeParse({ ...driver, birthDate: "1990-02-30" }).success).toBe(false);
  });
});
