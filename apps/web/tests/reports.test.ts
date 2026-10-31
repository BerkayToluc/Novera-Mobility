import { describe, expect, it } from "vitest";
import { buildReport, monthsBetween, previousMonth, splitEvenly } from "@/lib/report-calc";
import { barWidths, monthLabel, parseReportRange } from "@/lib/reports";
import { listMockExpenses } from "@/mocks/expenses";
import { listMockInvoices } from "@/mocks/invoices";
import { sampleReport } from "@/mocks/reports";
import { en, tr } from "../i18n/messages";
import { routing } from "../i18n/routing";
import { FLEET_SCREENS } from "../lib/fleet-screens";

// The report screen's rules (V2-39) without a browser: the months the address asks for, the arithmetic of the bars, and the sample report,
// which adds up to the sample invoices and expenses to the kuruş like the API's does. The same rules against the real API and the
// database are in apps/api/src/fleet/fleet-reports.integration.spec.ts.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const OTHER = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
let counter = 0;
const world = () => `reports-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;

describe("the months of the address", () => {
  it("the four choices: this month, the last three, this year, and a custom run", () => {
    expect(parseReportRange({ donem: "bu-ay" }, "2026-10")).toEqual({ choice: "bu-ay", from: "2026-10", to: "2026-10" });
    expect(parseReportRange({}, "2026-10")).toEqual({ choice: "son-3-ay", from: "2026-08", to: "2026-10" });
    expect(parseReportRange({ donem: "son-3-ay" }, "2026-02")).toEqual({ choice: "son-3-ay", from: "2025-12", to: "2026-02" });
    expect(parseReportRange({ donem: "bu-yil" }, "2026-10")).toEqual({ choice: "bu-yil", from: "2026-01", to: "2026-10" });
    expect(parseReportRange({ donem: "ozel", bas: "2025-11", bit: "2026-03" }, "2026-10")).toEqual({ choice: "ozel", from: "2025-11", to: "2026-03" });
  });

  it("a custom run that makes no sense falls back to the last three months", () => {
    const fallback = { choice: "son-3-ay", from: "2026-08", to: "2026-10" };
    for (const raw of [
      { donem: "ozel" },
      { donem: "ozel", bas: "2026-13", bit: "2026-10" },
      { donem: "ozel", bas: "2026-10", bit: "2026-09" },
      { donem: "ozel", bas: "2026-10", bit: "2026-12" },
      { donem: "ozel", bas: "2024-01", bit: "2026-10" },
      { donem: "yok" },
    ]) {
      expect(parseReportRange(raw, "2026-10"), JSON.stringify(raw)).toEqual(raw.donem === "ozel" || raw.donem === "yok" ? fallback : expect.anything());
    }
    expect(parseReportRange({ donem: "ozel", bas: "2024-11", bit: "2026-10" }, "2026-10").choice).toBe("ozel");
  });

  it("walks months across a year and writes them in the reader's language", () => {
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(previousMonth("2026-01", 2)).toBe("2025-11");
    expect(monthLabel("2026-10", "tr")).toBe("Ekim 2026");
    expect(monthLabel("2026-10", "en")).toBe("October 2026");
  });
});

describe("the bars", () => {
  it("share one scale, so a bar is as long as its number says; a segment of nothing is no width, a small one is still seen", () => {
    const widths = barWidths([{ segments: [600, 400] }, { segments: [250, 0] }, { segments: [1, 0] }, { segments: [0, 0] }]);
    expect(widths[0]).toEqual([60, 40]);
    expect(widths[1]![0]).toBe(25);
    expect(widths[1]![1]).toBe(0);
    expect(widths[2]![0]).toBeGreaterThan(0);
    expect(widths[3]).toEqual([0, 0]);
    expect(barWidths([{ segments: [0] }])).toEqual([[0]]);
    expect(barWidths([])).toEqual([]);
  });
});

describe("sharing an amount between cars", () => {
  it("adds up to the amount to the kuruş", () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(7, 0)).toEqual([]);
  });
});

describe("the sample report", () => {
  const months = (n: number) => previousMonth(new Date().toISOString().slice(0, 7), n);
  const thisMonth = new Date().toISOString().slice(0, 7);

  it("adds up to the sample invoices and expenses to the kuruş, whichever way it is cut", () => {
    const name = world();
    const report = sampleReport(name, EGE, months(2), thisMonth);
    const invoices = listMockInvoices(name, { page: 1, pageSize: 100, sort: null, q: "", status: null }, EGE).items.filter((invoice) => invoice.period >= months(2));
    expect(invoices.length).toBeGreaterThan(0);
    expect(report.totals.invoice).toBe(invoices.reduce((sum, invoice) => sum + invoice.subtotal, 0));
    const spent = listMockExpenses(name, { page: 1, pageSize: 100, sort: null, type: null, status: null }, EGE).items.filter((expense) => expense.occurredAt >= new Date(`${months(2)}-01T00:00:00+03:00`).toISOString());
    expect(report.totals.expenses).toBe(spent.reduce((sum, expense) => sum + expense.amount, 0));

    const sum = (rows: Array<{ invoice: number; expenses: number; total: number; km: number }>, key: "invoice" | "expenses" | "total" | "km") => rows.reduce((s, r) => s + r[key], 0);
    for (const key of ["invoice", "expenses", "total", "km"] as const) {
      expect(sum(report.months, key)).toBe(report.totals[key]);
      expect(sum(report.departments, key)).toBe(report.totals[key]);
    }
    expect(sum(report.vehicles, "invoice") + report.unallocated.invoice).toBe(report.totals.invoice);
    expect(sum(report.vehicles, "expenses")).toBe(report.totals.expenses);
    expect(sum(report.vehicles, "km")).toBe(report.totals.km);
  });

  it("puts the expenses in the department of the person who had the car then, and has kilometres from the readings", () => {
    const report = sampleReport(world(), EGE, months(2), thisMonth);
    expect(report.departments.find((row) => row.department === "Satış")!.expenses).toBeGreaterThan(0);
    expect(report.departments.find((row) => row.department === null)!.expenses).toBeGreaterThan(0);
    expect(report.totals.km).toBeGreaterThan(0);
  });

  it("is empty, not broken, for another company and for months with nothing in them", () => {
    const name = world();
    const other = sampleReport(name, OTHER, months(2), thisMonth);
    expect(other.totals).toEqual({ invoice: 0, expenses: 0, total: 0, km: 0 });
    expect(other.vehicles).toEqual([]);
    expect(sampleReport(name, EGE, "2020-01", "2020-02").totals).toEqual({ invoice: 0, expenses: 0, total: 0, km: 0 });
  });

  it("buildReport is empty for no rows", () => {
    expect(buildReport({ from: "2026-01", to: "2026-01", vehicles: [], invoices: [], expenses: [], now: Date.now() }).months).toHaveLength(1);
  });
});

describe("the words and the address", () => {
  it("the screen is in the menu in both languages and has its address in the router, and every key the page asks for exists", () => {
    const entry = FLEET_SCREENS.find((screen) => screen.key === "reports")!;
    expect(Object.keys(routing.pathnames)).toContain(entry.href);
    for (const language of [tr, en]) {
      expect(language.FleetPanel.nav.reports).toBeTruthy();
      const reports = language.FleetPanel.reports;
      for (const key of ["bu-ay", "son-3-ay", "bu-yil", "ozel"] as const) expect(reports.periods[key]).toBeTruthy();
      for (const key of ["total", "invoice", "expenses", "km"] as const) expect(reports.totals[key]).toBeTruthy();
    }
  });
});
