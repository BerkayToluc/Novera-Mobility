import { istanbulDateStart } from '../common/time.js';
import { assigneeAt } from './expense-calc.js';

// The fleet report (V2-39, docs/FLEET.md §3, §3.1): what a company spent and drove in a run of months, by month, by car and by department.
// Pure functions over rows that were already loaded, so the rules are tested without a database and the totals can be checked against
// the invoices and the expenses themselves. Money is TRY kuruş and always whole.

export const MAX_REPORT_MONTHS = 24;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonth = (value: string): boolean => {
  const match = MONTH.exec(value);
  return match !== null && Number(match[1]) >= 2000 && Number(match[1]) <= 2100;
};

export const nextMonth = (period: string): string => {
  const [year, month] = period.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
};

// "2026-08" … "2026-10", both ends included; empty when `from` is after `to`.
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to && months.length <= MAX_REPORT_MONTHS; month = nextMonth(month)) months.push(month);
  return months;
}

// The Istanbul month an instant is in.
export const monthOf = (at: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' }).format(at).slice(0, 7);

export const monthStart = (period: string): Date => istanbulDateStart(`${period}-01`);

// An amount divided into `parts` whole kuruş that add up to it exactly: the first `amount % parts` parts have one kuruş more. The order is
// the caller's (cars by plate), so the same invoice always splits the same way.
export function splitEvenly(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(amount / parts);
  const rest = amount - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < rest ? 1 : 0));
}

export type ReportReading = { at: Date; km: number };
export type ReportSpan = { employeeId: string; department: string | null; startedAt: Date; endedAt: Date | null };
export type ReportVehicle = { id: string; plate: string; model: string; contractNumber: string; startKm: number; readings: ReportReading[]; spans: ReportSpan[] };
export type ReportInvoice = { period: string; lines: Array<{ contractNumber: string; amount: number }> };
export type ReportExpense = { vehicleId: string; occurredAt: Date; amount: number };

// The odometer at an instant: the last reading at or before it, or the one the car started with when there is none. Readings never go back
// (the administration refuses a lower kilometre), but the larger of the two is taken anyway so a mistake in the data cannot make a car
// drive a negative distance.
export function kmAt(vehicle: Pick<ReportVehicle, 'startKm' | 'readings'>, at: Date): number {
  let km = vehicle.startKm;
  let latest = -Infinity;
  for (const reading of vehicle.readings) {
    if (reading.at.getTime() <= at.getTime() && reading.at.getTime() >= latest) {
      latest = reading.at.getTime();
      km = reading.km;
    }
  }
  return km;
}

export type Money = { invoice: number; expenses: number; total: number };
export type MonthRow = Money & { period: string; km: number };
export type VehicleRow = Money & { id: string; plate: string; model: string; km: number };
export type DepartmentRow = Money & { department: string | null; km: number };
export type Report = {
  from: string;
  to: string;
  months: MonthRow[];
  vehicles: VehicleRow[];
  departments: DepartmentRow[];
  // The part of the invoices that no car could carry: a contract with no car on it (a service contract such as VIP transfers).
  unallocated: { invoice: number };
  totals: Money & { km: number };
};

const money = (invoice = 0, expenses = 0): Money => ({ invoice, expenses, total: invoice + expenses });

// The report. How the invoices are shared out, in one place (and in docs/FLEET.md §3.1):
//  - the cost of a car is its share of the invoice lines of its contract plus its expenses; the invoices are taken without VAT, the way their
//    lines add up (the subtotal), so that the report adds up to the lines to the kuruş;
//  - a line of an invoice is divided equally between all the cars of the contract, whatever their state, by plate; the kuruş that do not
//    divide go to the first cars. A contract with no cars carries nothing: its lines are `unallocated`, and are in the totals;
//  - an invoice belongs to the month it is for (its period), an expense to the Istanbul month it happened in;
//  - the department of a cost is the department of the person who had the car at the end of the invoice's month, or at the moment of the
//    expense; no person, or a person with no department, is `null`;
//  - the kilometres of a month are the odometer at the end of the month (or now, for the current one) less the odometer at its start; they
//    are the department's of whoever had the car at the end of that month.
export function buildReport(input: { from: string; to: string; vehicles: ReportVehicle[]; invoices: ReportInvoice[]; expenses: ReportExpense[]; now: Date }): Report {
  const months = monthsBetween(input.from, input.to);
  const vehicles = [...input.vehicles].sort((a, b) => (a.plate < b.plate ? -1 : a.plate > b.plate ? 1 : 0));
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const monthRows = new Map(months.map((period) => [period, { period, ...money(), km: 0 } as MonthRow]));
  const vehicleRows = new Map(vehicles.map((vehicle) => [vehicle.id, { id: vehicle.id, plate: vehicle.plate, model: vehicle.model, ...money(), km: 0 } as VehicleRow]));
  const departmentRows = new Map<string | null, DepartmentRow>();
  const department = (key: string | null): DepartmentRow => {
    let row = departmentRows.get(key);
    if (!row) departmentRows.set(key, (row = { department: key, ...money(), km: 0 }));
    return row;
  };
  const add = (target: Money, kind: 'invoice' | 'expenses', amount: number) => {
    target[kind] += amount;
    target.total += amount;
  };
  let unallocated = 0;

  // The department of a car at an instant (null when nobody had it or the person has none).
  const departmentAt = (vehicle: ReportVehicle, at: Date): string | null => assigneeAt(vehicle.spans, at)?.department ?? null;
  const endOf = (period: string): Date => new Date(Math.min(monthStart(nextMonth(period)).getTime() - 1, input.now.getTime()));

  for (const invoice of input.invoices) {
    const month = monthRows.get(invoice.period);
    if (!month) continue;
    for (const line of invoice.lines) {
      const cars = vehicles.filter((vehicle) => vehicle.contractNumber === line.contractNumber);
      if (cars.length === 0) {
        unallocated += line.amount;
        add(month, 'invoice', line.amount);
        add(department(null), 'invoice', line.amount);
        continue;
      }
      splitEvenly(line.amount, cars.length).forEach((share, index) => {
        const car = cars[index]!;
        add(month, 'invoice', share);
        add(vehicleRows.get(car.id)!, 'invoice', share);
        add(department(departmentAt(car, endOf(invoice.period))), 'invoice', share);
      });
    }
  }

  for (const expense of input.expenses) {
    const car = byId.get(expense.vehicleId);
    const month = monthRows.get(monthOf(expense.occurredAt));
    if (!car || !month) continue;
    add(month, 'expenses', expense.amount);
    add(vehicleRows.get(car.id)!, 'expenses', expense.amount);
    add(department(departmentAt(car, expense.occurredAt)), 'expenses', expense.amount);
  }

  for (const period of months) {
    const start = monthStart(period);
    // A month that has not started has no kilometres.
    if (start.getTime() > input.now.getTime()) continue;
    const end = endOf(period);
    for (const car of vehicles) {
      const driven = Math.max(0, kmAt(car, end) - kmAt(car, new Date(start.getTime() - 1)));
      if (driven === 0) continue;
      monthRows.get(period)!.km += driven;
      vehicleRows.get(car.id)!.km += driven;
      department(departmentAt(car, end)).km += driven;
    }
  }

  const rows = [...vehicleRows.values()].filter((row) => row.total > 0 || row.km > 0).sort((a, b) => b.total - a.total || b.km - a.km || (a.plate < b.plate ? -1 : 1));
  const departments = [...departmentRows.values()].sort((a, b) => b.total - a.total || b.km - a.km || (a.department ?? '￿').localeCompare(b.department ?? '￿', 'tr'));
  const list = [...monthRows.values()];
  const totals = { ...money(list.reduce((sum, row) => sum + row.invoice, 0), list.reduce((sum, row) => sum + row.expenses, 0)), km: list.reduce((sum, row) => sum + row.km, 0) };
  return { from: input.from, to: input.to, months: list, vehicles: rows, departments, unallocated: { invoice: unallocated }, totals };
}
