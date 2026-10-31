import { describe, expect, it } from "vitest";
import { parseAdminListParams } from "@/lib/admin-query";
import { assigneeAt, canMove, cleanFleetExpenseFilters, expenseFormSchema, EXPENSE_STATUSES, EXPENSE_TYPES, expenseTone, FLEET_EXPENSE_LIST, isMoment, isReflectable, momentToIso, toExpenseBody, type ExpenseFormValues } from "@/lib/expenses";
import { createMockExpense, expenseSummary, getMockExpense, listMockExpenses, reflectMockExpenses, requestMockRenewal, setMockExpenseStatus } from "@/mocks/expenses";
import { fleetSummary } from "@/mocks/fleet-panel";
import { getMockContract } from "@/mocks/admin-contracts";
import { listMockQuotes } from "@/mocks/admin-quotes";
import { en, tr } from "../i18n/messages";

// The expense screens' rules (V2-38) without a browser: who an expense belongs to, what may be done to it, the form, the lists' addresses,
// and the sample expenses, which behave like the API's. The same rules against the real API and the database are in
// apps/api/src/fleet/fleet-expenses.integration.spec.ts.
const EGE = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01";
const OTHER = "5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e03";
const CAR_101 = "7c000000-0000-4000-8000-000000000001";
const all = { page: 1, pageSize: 50, sort: null, type: null, status: null } as const;
let counter = 0;
const world = () => `expenses-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;
const form = (extra: Partial<ExpenseFormValues> = {}): ExpenseFormValues => ({ plate: "35 FLM 101", type: "HGS", occurredAt: "2026-10-01T09:30", amount: "85,50", description: "", place: "", ...extra });

describe("who an expense belongs to", () => {
  const spans = [
    { employeeId: "ayse", startedAt: "2026-09-01T08:00:00.000Z", endedAt: "2026-10-10T12:00:00.000Z" },
    { employeeId: "burak", startedAt: "2026-10-10T12:00:00.000Z", endedAt: null },
  ];

  it("the expenses on either side of a handover go to the person who had the car, and the moment of it to the one who takes it", () => {
    expect(assigneeAt(spans, "2026-10-10T11:59:59.999Z")?.employeeId).toBe("ayse");
    expect(assigneeAt(spans, "2026-10-10T12:00:00.000Z")?.employeeId).toBe("burak");
    expect(assigneeAt(spans, "2026-10-10T12:00:00.001Z")?.employeeId).toBe("burak");
  });

  it("before the first assignment, or on a car nobody had, there is nobody; the order given does not matter", () => {
    expect(assigneeAt(spans, "2026-08-31T00:00:00.000Z")).toBeNull();
    expect(assigneeAt([], "2026-10-10T12:00:00.000Z")).toBeNull();
    expect(assigneeAt([...spans].reverse(), "2026-10-01T00:00:00.000Z")?.employeeId).toBe("ayse");
  });
});

describe("what may be done to an expense", () => {
  it("open can be reflected or disputed, a dispute can be taken back, a reflected expense is final", () => {
    expect(canMove("OPEN", "REFLECTED")).toBe(true);
    expect(canMove("OPEN", "DISPUTED")).toBe(true);
    expect(canMove("DISPUTED", "OPEN")).toBe(true);
    expect(canMove("DISPUTED", "REFLECTED")).toBe(false);
    expect(canMove("REFLECTED", "OPEN")).toBe(false);
    expect(canMove("REFLECTED", "DISPUTED")).toBe(false);
    for (const state of EXPENSE_STATUSES) expect(canMove(state, state)).toBe(true);
  });

  it("only an open expense that had a person can be chosen for reflecting", () => {
    const person = { id: "x", name: "Ayşe Demir", department: null };
    expect(isReflectable({ status: "OPEN", employee: person })).toBe(true);
    expect(isReflectable({ status: "OPEN", employee: null })).toBe(false);
    expect(isReflectable({ status: "DISPUTED", employee: person })).toBe(false);
    expect(isReflectable({ status: "REFLECTED", employee: person })).toBe(false);
  });

  it("every state has a tone, and the word comes with it", () => {
    expect(EXPENSE_STATUSES.map(expenseTone)).toEqual(["warning", "success", "error"]);
  });
});

describe("the administrator's form", () => {
  const messages = { plate: "plate", type: "type", occurredAt: "occurredAt", amount: "amount", description: "description", place: "place" };
  const schema = expenseFormSchema(messages);
  const failing = (values: ExpenseFormValues) => {
    const result = schema.safeParse(values);
    return result.success ? [] : [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  };

  it("takes a good entry, and writes the amount in kuruş and the moment as Istanbul time", () => {
    expect(failing(form())).toEqual([]);
    expect(toExpenseBody(form({ description: " Geçiş ", place: "Avrasya Tüneli" }))).toEqual({ plate: "35 FLM 101", type: "HGS", occurredAt: "2026-10-01T06:30:00.000Z", amount: 8550, description: "Geçiş", place: "Avrasya Tüneli" });
    expect(toExpenseBody(form()).description).toBeUndefined();
  });

  it("names every field that is wrong", () => {
    expect(failing(form({ plate: " " }))).toEqual(["plate"]);
    expect(failing(form({ type: "TAX" }))).toEqual(["type"]);
    for (const occurredAt of ["", "2026-10-01", "2026-02-30T10:00", "2026-10-01T25:00", "dün"]) expect(failing(form({ occurredAt })), occurredAt).toEqual(["occurredAt"]);
    for (const amount of ["", "0", "0,00", "abc", "1.234,50", "-5", "85,555"]) expect(failing(form({ amount })), amount).toEqual(["amount"]);
    expect(failing(form({ description: "x".repeat(201) }))).toEqual(["description"]);
    expect(failing(form({ place: "y".repeat(101) }))).toEqual(["place"]);
  });

  it("reads a moment only in the form the date-time field writes", () => {
    expect(isMoment("2026-10-31T23:59")).toBe(true);
    expect(isMoment("2026-10-31 23:59")).toBe(false);
    expect(momentToIso("2026-10-31T00:00")).toBe("2026-10-30T21:00:00.000Z");
  });
});

describe("the customer's list address", () => {
  it("knows the type, the state, the car, the person and the days, and falls back for what is not allowed", () => {
    const params = parseAdminListParams({ tur: "PENALTY", durum: "WAT", arac: CAR_101, personel: "yok", bas: "2026-10-01", bit: "bugun" }, FLEET_EXPENSE_LIST);
    expect(params.filters).toMatchObject({ tur: "PENALTY", arac: CAR_101, personel: "yok", bas: "2026-10-01", bit: "bugun" });
    expect(params.filters.durum).toBeUndefined();
    expect(params.sort).toEqual({ key: "occurredAt", dir: "desc" });
  });

  it("drops the free values that are not what they should be, so a made-up address shows the list", () => {
    expect(cleanFleetExpenseFilters({ arac: "x", personel: "kimse", bas: "2026-02-30", bit: "2026-10-31" })).toEqual({ bit: "2026-10-31" });
    expect(cleanFleetExpenseFilters({ arac: CAR_101, personel: "yok" })).toEqual({ arac: CAR_101, personel: "yok" });
  });
});

describe("the sample expenses", () => {
  it("are the company's own, newest first, and each has the person who had the car at that moment", () => {
    const page = listMockExpenses(world(), all, EGE);
    expect(page.total).toBe(9);
    expect(page.items.map((row) => row.occurredAt)).toEqual([...page.items.map((row) => row.occurredAt)].sort().reverse());
    const people = page.items.map((row) => row.employee?.name ?? null);
    expect(people.filter((name) => name === "Ayşe Demir")).toHaveLength(5);
    expect(people.filter((name) => name === "Burak Yılmaz")).toHaveLength(2);
    expect(people.filter((name) => name === null)).toHaveLength(2);
    expect(listMockExpenses(world(), all, OTHER).total).toBe(0);
  });

  it("narrow by type, state, car, person, none and day", () => {
    const name = world();
    expect(listMockExpenses(name, { ...all, type: "PENALTY" }, EGE).total).toBe(2);
    expect(listMockExpenses(name, { ...all, status: "DISPUTED" }, EGE).total).toBe(1);
    expect(listMockExpenses(name, { ...all, vehicle: CAR_101 }, EGE).total).toBe(6);
    expect(listMockExpenses(name, { ...all, employee: "none" }, EGE).total).toBe(2);
    const ayse = listMockExpenses(name, all, EGE).items.find((row) => row.employee?.name === "Ayşe Demir")!.employee!.id;
    expect(listMockExpenses(name, { ...all, employee: ayse }, EGE).total).toBe(5);
    const today = new Date().toISOString().slice(0, 10);
    expect(listMockExpenses(name, { ...all, from: today, to: today }, EGE).total).toBe(0);
    expect(listMockExpenses(name, { ...all, sort: { key: "amount", dir: "desc" } }, EGE).items[0]!.amount).toBe(185_000);
  });

  it("another company's expense is not found", () => {
    const name = world();
    const id = listMockExpenses(name, all, EGE).items[0]!.id;
    expect(getMockExpense(name, id, EGE)?.id).toBe(id);
    expect(getMockExpense(name, id, OTHER)).toBeNull();
    expect(setMockExpenseStatus(name, OTHER, id, "x", "DISPUTED")).toEqual({ status: "not_found" });
    expect(reflectMockExpenses(name, OTHER, [id])).toEqual({ status: "not_found" });
  });

  it("an open expense is disputed and taken back; a stale copy is refused; a reflected expense is final; nobody gets a reflection", () => {
    const name = world();
    const open = listMockExpenses(name, { ...all, status: "OPEN" }, EGE).items;
    const row = open.find((entry) => entry.employee)!;
    const disputed = setMockExpenseStatus(name, EGE, row.id, row.updatedAt, "DISPUTED");
    expect(disputed.status).toBe("ok");
    expect(setMockExpenseStatus(name, EGE, row.id, row.updatedAt, "OPEN")).toEqual({ status: "stale" });
    const version = (disputed as { value: { updatedAt: string } }).value.updatedAt;
    expect(setMockExpenseStatus(name, EGE, row.id, version, "REFLECTED")).toEqual({ status: "not_allowed" });
    const back = setMockExpenseStatus(name, EGE, row.id, version, "OPEN") as { value: { updatedAt: string } };
    const reflected = setMockExpenseStatus(name, EGE, row.id, back.value.updatedAt, "REFLECTED") as { value: { updatedAt: string } };
    expect(setMockExpenseStatus(name, EGE, row.id, reflected.value.updatedAt, "OPEN")).toEqual({ status: "not_allowed" });
    const nobody = open.find((entry) => entry.employee === null)!;
    expect(setMockExpenseStatus(name, EGE, nobody.id, nobody.updatedAt, "REFLECTED")).toEqual({ status: "not_allowed" });
  });

  it("reflecting many changes only the open ones that had a person, and a foreign id refuses all", () => {
    const name = world();
    const rows = listMockExpenses(name, all, EGE).items;
    const result = reflectMockExpenses(name, EGE, rows.map((row) => row.id));
    expect(result).toEqual({ status: "ok", reflected: 5, skipped: 4 });
    expect(listMockExpenses(name, { ...all, status: "REFLECTED" }, EGE).total).toBe(6);
    expect(reflectMockExpenses(name, EGE, [rows[0]!.id, "b1000000-0000-4000-8000-ffffffffffff"])).toEqual({ status: "not_found" });
  });

  it("an expense is entered by the plate; an unknown plate, a future moment and an amount of nothing are refused", () => {
    const name = world();
    // Five days ago: the car was Ayşe's then (the sample gave it to her sixty days ago), so the entry carries her.
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 16);
    const made = createMockExpense(name, form({ plate: "35flm101", place: "Avrasya Tüneli", occurredAt: fiveDaysAgo }));
    expect(made).toMatchObject({ status: "ok", value: { status: "OPEN", amount: 8550, vehicle: { plate: "35 FLM 101" }, company: { id: EGE }, employee: { name: "Ayşe Demir" } } });
    expect(createMockExpense(name, form({ plate: "34 ZZZ 999" }))).toEqual({ status: "invalid", fields: { plate: "UNKNOWN_REFERENCE" } });
    expect(createMockExpense(name, form({ occurredAt: "2099-01-01T10:00" }))).toEqual({ status: "invalid", fields: { occurredAt: "OUT_OF_RANGE" } });
    expect(createMockExpense(name, form({ amount: "0" }))).toEqual({ status: "invalid", fields: { amount: "OUT_OF_RANGE" } });
    expect(listMockExpenses(name, all, EGE).total).toBe(10);
  });

  it("the summary counts the open ones and what they add up to, and the Filom summary carries it", () => {
    const name = world();
    const summary = expenseSummary(name, EGE);
    expect(summary.open.count).toBe(7);
    expect(summary.open.total).toBe(8_550 + 12_000 + 119_000 + 185_000 + 7_300 + 135_000 + 5_200);
    expect(fleetSummary(name, EGE).expenses).toEqual(summary);
    expect(expenseSummary(name, OTHER)).toEqual({ open: { count: 0, total: 0 } });
  });
});

describe("the renewal request", () => {
  it("opens a quote request marked as a renewal that the panel finds, once while it is being handled", () => {
    const name = world();
    const number = getMockContract(name, `SZL-${new Date().getUTCFullYear()}-00001`)!.number;
    const made = requestMockRenewal(name, EGE, number.toLowerCase(), "Beş araç daha");
    expect(made).toMatchObject({ status: "ok", referenceNumber: expect.stringMatching(/^TKL-\d{4}-\d{5}$/) });
    const listed = listMockQuotes(name, { page: 1, pageSize: 50, sort: null, q: "", status: null, source: "FLEET_RENEWAL" });
    expect(listed.items.map((entry) => entry.number)).toContain((made as { referenceNumber: string }).referenceNumber);
    expect(requestMockRenewal(name, EGE, number, null)).toEqual({ status: "already" });
    expect(requestMockRenewal(name, OTHER, number, null)).toEqual({ status: "not_found" });
    expect(requestMockRenewal(name, EGE, "SZL-2000-99999", null)).toEqual({ status: "not_found" });
  });
});

describe("the words", () => {
  it("every type and state has a word in both languages", () => {
    for (const language of [tr, en]) {
      for (const type of EXPENSE_TYPES) {
        expect(language.Admin.fleetExpenses.type[type]).toBeTruthy();
        expect(language.FleetPanel.expenses.type[type]).toBeTruthy();
      }
      for (const status of EXPENSE_STATUSES) {
        expect(language.Admin.fleetExpenses.status[status]).toBeTruthy();
        expect(language.FleetPanel.expenses.status[status]).toBeTruthy();
      }
    }
  });
});
