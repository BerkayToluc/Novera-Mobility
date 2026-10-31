import type { components } from "./api-types";
import { assigneeAt } from "./expenses";

// The fleet report for the sample mode (V2-39, docs/FLEET.md §3.1): the same rules as the API's (apps/api/src/fleet/report-calc.ts), over
// the sample rows. The real site never runs this; it reads `GET /fleet/reports`. Money is TRY kuruş and always whole.
export type FleetReport = components["schemas"]["FleetReport"];

export const MAX_REPORT_MONTHS = 24;

export const isMonth = (value: string): boolean => /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value);

export const nextMonth = (period: string): string => {
  const [year, month] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
};

export const previousMonth = (period: string, count = 1): string => {
  const [year, month] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 1 - count, 1)).toISOString().slice(0, 7);
};

// "2026-08" … "2026-10", both ends included; empty when `from` is after `to`.
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to && months.length <= MAX_REPORT_MONTHS; month = nextMonth(month)) months.push(month);
  return months;
}

// Turkey has had one offset (+03:00) all year since 2016, so a month starts at midnight there.
const monthStart = (period: string): number => Date.parse(`${period}-01T00:00:00+03:00`);
export const monthOf = (iso: string): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);

// An amount divided into whole kuruş that add up to it exactly: the first `amount % parts` parts have one kuruş more.
export function splitEvenly(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(amount / parts);
  const rest = amount - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < rest ? 1 : 0));
}

export type SampleVehicle = {
  id: string;
  plate: string;
  model: string;
  contractNumber: string;
  startKm: number;
  readings: Array<{ at: string; km: number }>;
  spans: Array<{ employeeId: string; department: string | null; startedAt: string; endedAt: string | null }>;
};

const kmAt = (vehicle: SampleVehicle, at: number): number => {
  let km = vehicle.startKm;
  let latest = -Infinity;
  for (const reading of vehicle.readings) {
    const time = Date.parse(reading.at);
    if (time <= at && time >= latest) {
      latest = time;
      km = reading.km;
    }
  }
  return km;
};

type Money = { invoice: number; expenses: number; total: number };
const money = (invoice = 0, expenses = 0): Money => ({ invoice, expenses, total: invoice + expenses });

export function buildReport(input: {
  from: string;
  to: string;
  vehicles: SampleVehicle[];
  invoices: Array<{ period: string; lines: Array<{ contractNumber: string; amount: number }> }>;
  expenses: Array<{ vehicleId: string; occurredAt: string; amount: number }>;
  now: number;
}): FleetReport {
  const months = monthsBetween(input.from, input.to);
  const vehicles = [...input.vehicles].sort((a, b) => (a.plate < b.plate ? -1 : a.plate > b.plate ? 1 : 0));
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const monthRows = new Map(months.map((period) => [period, { period, ...money(), km: 0 }]));
  const vehicleRows = new Map(vehicles.map((vehicle) => [vehicle.id, { id: vehicle.id, plate: vehicle.plate, model: vehicle.model, ...money(), km: 0 }]));
  const departmentRows = new Map<string | null, { department: string | null } & Money & { km: number }>();
  const department = (key: string | null) => {
    let row = departmentRows.get(key);
    if (!row) departmentRows.set(key, (row = { department: key, ...money(), km: 0 }));
    return row;
  };
  const add = (target: Money, kind: "invoice" | "expenses", amount: number) => {
    target[kind] += amount;
    target.total += amount;
  };
  let unallocated = 0;
  const departmentAt = (vehicle: SampleVehicle, at: number): string | null => assigneeAt(vehicle.spans, new Date(at).toISOString())?.department ?? null;
  const endOf = (period: string): number => Math.min(monthStart(nextMonth(period)) - 1, input.now);

  for (const invoice of input.invoices) {
    const month = monthRows.get(invoice.period);
    if (!month) continue;
    for (const line of invoice.lines) {
      const cars = vehicles.filter((vehicle) => vehicle.contractNumber === line.contractNumber);
      if (cars.length === 0) {
        unallocated += line.amount;
        add(month, "invoice", line.amount);
        add(department(null), "invoice", line.amount);
        continue;
      }
      splitEvenly(line.amount, cars.length).forEach((share, index) => {
        const car = cars[index]!;
        add(month, "invoice", share);
        add(vehicleRows.get(car.id)!, "invoice", share);
        add(department(departmentAt(car, endOf(invoice.period))), "invoice", share);
      });
    }
  }
  for (const expense of input.expenses) {
    const car = byId.get(expense.vehicleId);
    const month = monthRows.get(monthOf(expense.occurredAt));
    if (!car || !month) continue;
    add(month, "expenses", expense.amount);
    add(vehicleRows.get(car.id)!, "expenses", expense.amount);
    add(department(departmentAt(car, Date.parse(expense.occurredAt))), "expenses", expense.amount);
  }
  for (const period of months) {
    const start = monthStart(period);
    if (start > input.now) continue;
    const end = endOf(period);
    for (const car of vehicles) {
      const driven = Math.max(0, kmAt(car, end) - kmAt(car, start - 1));
      if (driven === 0) continue;
      monthRows.get(period)!.km += driven;
      vehicleRows.get(car.id)!.km += driven;
      department(departmentAt(car, end)).km += driven;
    }
  }

  const rows = [...vehicleRows.values()].filter((row) => row.total > 0 || row.km > 0).sort((a, b) => b.total - a.total || b.km - a.km || (a.plate < b.plate ? -1 : 1));
  const departments = [...departmentRows.values()].sort((a, b) => b.total - a.total || b.km - a.km || (a.department ?? "￿").localeCompare(b.department ?? "￿", "tr"));
  const list = [...monthRows.values()];
  const invoiceTotal = list.reduce((sum, row) => sum + row.invoice, 0);
  const expenseTotal = list.reduce((sum, row) => sum + row.expenses, 0);
  return {
    from: input.from,
    to: input.to,
    months: list,
    vehicles: rows,
    departments,
    unallocated: { invoice: unallocated },
    totals: { ...money(invoiceTotal, expenseTotal), km: list.reduce((sum, row) => sum + row.km, 0) },
  };
}
