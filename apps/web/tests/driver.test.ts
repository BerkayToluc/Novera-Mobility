import { describe, expect, it } from "vitest";
import { checkEligibility, fullYears, isIsoDate, rentalStartDate } from "@/lib/driver-eligibility";
import { classRequirement, requirementsFor } from "@/lib/driver-rules";
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
  it("is the class's rule plus the licence country's", () => {
    expect(requirementsFor("economy", "TR")).toEqual({ minAge: 21, minLicenceYears: 2, internationalPermit: false });
    expect(requirementsFor("suv", "DE")).toEqual({ minAge: 23, minLicenceYears: 4, internationalPermit: false });
    expect(requirementsFor("suv", "US")).toEqual({ minAge: 23, minLicenceYears: 5, internationalPermit: true });
    expect(requirementsFor("executive", "GB")).toEqual({ minAge: 25, minLicenceYears: 6, internationalPermit: false });
  });
  it("falls back to the old general rule for an unknown class", () => {
    expect(classRequirement("hovercraft")).toEqual({ minAge: 21, minLicenceYears: 2 });
  });
});

describe("checkEligibility", () => {
  const economyTr = requirementsFor("economy", "TR");
  const start = "2026-12-14";

  it("passes someone who turns 21 on the first day and has two full years", () => {
    const result = checkEligibility({ birthDate: "2005-12-14", licenceIssuedAt: "2024-12-14" }, economyTr, start);
    expect(result).toMatchObject({ ok: true, reasons: [], ageYears: 21, licenceYears: 2 });
  });
  it("fails someone a day short of 21", () => {
    const result = checkEligibility({ birthDate: "2005-12-15", licenceIssuedAt: "2020-01-01" }, economyTr, start);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(["age"]);
  });
  it("fails a licence a day short of the years it needs", () => {
    const result = checkEligibility({ birthDate: "1990-01-01", licenceIssuedAt: "2024-12-15" }, economyTr, start);
    expect(result.reasons).toEqual(["licence_years"]);
  });
  it("reports both reasons together", () => {
    const result = checkEligibility({ birthDate: "2010-01-01", licenceIssuedAt: "2026-01-01" }, economyTr, start);
    expect(result.reasons).toEqual(["age", "licence_years"]);
  });
  it("asks more of a foreign licence: the same driver passes with a Turkish one and fails with a US one", () => {
    const driver = { birthDate: "1995-05-05", licenceIssuedAt: "2023-12-01" }; // 3 years of licence
    expect(checkEligibility(driver, requirementsFor("suv", "TR"), start).ok).toBe(true);
    expect(checkEligibility(driver, requirementsFor("suv", "US"), start).reasons).toEqual(["licence_years"]);
  });
  it("counts on the rental's first day, not on today", () => {
    const driver = { birthDate: "2005-12-14", licenceIssuedAt: "2020-01-01" };
    expect(checkEligibility(driver, economyTr, "2026-12-13").ok).toBe(false);
    expect(checkEligibility(driver, economyTr, "2026-12-14").ok).toBe(true);
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
