import { describe, expect, it } from "vitest";
import { parseAdminListParams } from "@/lib/admin-query";
import { ADMIN_INVOICE_LIST, billingPeriods, FLEET_INVOICE_LIST, INVOICE_STATUSES, invoiceTone, isPeriod, periodLabel } from "@/lib/invoices";
import { fleetSummary } from "@/mocks/fleet-panel";
import { generateMockInvoices, getMockInvoice, invoiceSummary, listMockInvoices, setMockInvoicePaid } from "@/mocks/invoices";

// The invoice screens' rules (V2-37) without a browser: the months that can be billed, the lists' addresses, and the sample invoices,
// which behave like the API's (a month is made once, the lines add up to the kuruş, "late" is worked out, a change carries its version).
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const all = { page: 1, pageSize: 50, sort: null, q: "", status: null } as const;
let counter = 0;
const world = () => `invoices-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;

describe("the months that can be billed", () => {
  it("are this month and the eleven before it, newest first, across a year", () => {
    expect(billingPeriods("2026-10-31")).toEqual(["2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11"]);
    expect(billingPeriods("2026-01-01", 3)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });

  it("a month is YYYY-MM with a real month", () => {
    for (const good of ["2026-10", "2026-01", "2026-12"]) expect(isPeriod(good)).toBe(true);
    for (const bad of ["2026-13", "2026-00", "2026-1", "26-10", "2026-10-01", "", "bu-ay"]) expect(isPeriod(bad)).toBe(false);
  });

  it("is written out in the reader's language", () => {
    expect(periodLabel("2026-10", "tr")).toBe("Ekim 2026");
    expect(periodLabel("2026-10", "en")).toBe("October 2026");
  });
});

describe("the lists' addresses", () => {
  it("default to the newest invoice first, and take a state; anything else falls back", () => {
    expect(parseAdminListParams({}, ADMIN_INVOICE_LIST).sort).toEqual({ key: "issuedAt", dir: "desc" });
    expect(parseAdminListParams({}, FLEET_INVOICE_LIST).sort).toEqual({ key: "period", dir: "desc" });
    expect(parseAdminListParams({ durum: "OVERDUE" }, FLEET_INVOICE_LIST).filters).toEqual({ durum: "OVERDUE" });
    expect(parseAdminListParams({ durum: "LATE" }, FLEET_INVOICE_LIST).filters).toEqual({});
    expect(parseAdminListParams({ sirala: "total:asc" }, ADMIN_INVOICE_LIST).sort).toEqual({ key: "total", dir: "asc" });
    expect(parseAdminListParams({ sirala: "lines:asc" }, ADMIN_INVOICE_LIST).sort).toEqual({ key: "issuedAt", dir: "desc" });
  });

  it("a state has a tone, and late is the one that asks for attention", () => {
    expect(INVOICE_STATUSES.map(invoiceTone)).toEqual(["success", "warning", "error"]);
  });
});

describe("the sample invoices", () => {
  it("the sample company has three: the oldest paid, then a late one, then one waiting; another company has none", () => {
    const w = world();
    const page = listMockInvoices(w, { ...all, sort: { key: "period", dir: "asc" } }, EGE);
    expect(page.items.map((row) => row.status)).toEqual(["PAID", "OVERDUE", "PENDING"]);
    expect(listMockInvoices(w, all, "someone-else").total).toBe(0);
    for (const row of page.items) {
      expect(row.subtotal).toBe(row.lines.reduce((sum, line) => sum + line.amount, 0));
      expect(row.total).toBe(row.subtotal + row.vat);
    }
  });

  it("another company's invoice is not found, and a number is found whatever its case", () => {
    const w = world();
    const number = listMockInvoices(w, all, EGE).items[0]!.number;
    expect(getMockInvoice(w, number.toLowerCase(), EGE)?.number).toBe(number);
    expect(getMockInvoice(w, number, "someone-else")).toBeNull();
    expect(getMockInvoice(w, "FTR-2000-99999")).toBeNull();
  });

  it("searches by number and company, and narrows by state", () => {
    const w = world();
    expect(listMockInvoices(w, { ...all, status: "OVERDUE" }).total).toBe(1);
    expect(listMockInvoices(w, { ...all, q: "ege lojistik" }).total).toBe(3);
    expect(listMockInvoices(w, { ...all, q: "kimse" }).total).toBe(0);
  });

  it("a month is made once: the second time is refused and changes nothing, a month that has not started cannot be made", () => {
    const w = world();
    const month = new Date().toISOString().slice(0, 7);
    const first = generateMockInvoices(w, month);
    expect(first).toEqual({ status: "ok", period: month, created: 1 });
    expect(generateMockInvoices(w, month)).toEqual({ status: "already" });
    expect(listMockInvoices(w, all).total).toBe(4);
    const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
    expect(generateMockInvoices(w, nextMonth)).toEqual({ status: "future" });
    expect(generateMockInvoices(w, "2026-13")).toEqual({ status: "invalid" });
  });

  it("a month that is already in the sample is refused, and a month with no contract makes nothing", () => {
    const w = world();
    const made = listMockInvoices(w, all).items[0]!.period;
    expect(generateMockInvoices(w, made)).toEqual({ status: "already" });
    expect(generateMockInvoices(w, "2001-01")).toEqual({ status: "ok", period: "2001-01", created: 0 });
  });

  it("marking an invoice paid carries the version, ends the lateness, and can be taken back", () => {
    const w = world();
    const late = listMockInvoices(w, { ...all, status: "OVERDUE" }).items[0]!;
    expect(setMockInvoicePaid(w, late.number, "2000-01-01T00:00:00.000Z", true)).toEqual({ status: "stale" });
    expect(setMockInvoicePaid(w, "FTR-2000-99999", late.updatedAt, true)).toEqual({ status: "not_found" });

    const paid = setMockInvoicePaid(w, late.number, late.updatedAt, true);
    expect(paid.status).toBe("ok");
    if (paid.status !== "ok") return;
    expect(paid.value.status).toBe("PAID");
    expect(paid.value.paidAt).not.toBeNull();
    expect(paid.value.updatedAt > late.updatedAt).toBe(true);
    // The old copy of the screen is now stale.
    expect(setMockInvoicePaid(w, late.number, late.updatedAt, false)).toEqual({ status: "stale" });

    const back = setMockInvoicePaid(w, late.number, paid.value.updatedAt, false);
    expect(back.status === "ok" && back.value.status).toBe("OVERDUE");
  });

  it("the summary counts what is still to be paid, and this month's invoice once it is made", () => {
    const w = world();
    const before = invoiceSummary(w, EGE);
    expect(before.thisMonth).toBeNull();
    expect(before.unpaid.count).toBe(2);
    expect(before.overdue).toBe(1);

    generateMockInvoices(w, new Date().toISOString().slice(0, 7));
    const after = invoiceSummary(w, EGE);
    expect(after.thisMonth).toMatchObject({ status: "PENDING" });
    expect(after.unpaid.count).toBe(3);
    expect(after.unpaid.total).toBe(before.unpaid.total + after.thisMonth!.total);
    expect(fleetSummary(w, EGE).invoices).toEqual(after);
    expect(invoiceSummary(w, "someone-else")).toEqual({ thisMonth: null, unpaid: { count: 0, total: 0 }, overdue: 0 });
  });
});
