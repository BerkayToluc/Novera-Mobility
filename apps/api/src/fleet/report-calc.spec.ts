import { buildReport, kmAt, monthsBetween, monthOf, splitEvenly, type ReportVehicle } from './report-calc.js';

const at = (iso: string) => new Date(iso);

describe('the months of a report (V2-39)', () => {
  it('runs from the first to the last, both included, across a year', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween('2026-10', '2026-10')).toEqual(['2026-10']);
    expect(monthsBetween('2026-10', '2026-09')).toEqual([]);
  });

  it('puts an instant in the Istanbul month, not the UTC one', () => {
    expect(monthOf(at('2026-09-30T21:00:00.000Z'))).toBe('2026-10');
    expect(monthOf(at('2026-09-30T20:59:59.999Z'))).toBe('2026-09');
  });
});

describe('sharing an amount between cars', () => {
  it('adds up to the amount to the kuruş, the first cars getting the extra kuruş', () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(2, 5)).toEqual([1, 1, 0, 0, 0]);
    expect(splitEvenly(0, 2)).toEqual([0, 0]);
    expect(splitEvenly(5, 0)).toEqual([]);
    for (const [amount, parts] of [[10_800_000, 7], [999_999_999, 13], [1, 3]] as const) expect(splitEvenly(amount, parts).reduce((a, b) => a + b, 0)).toBe(amount);
  });
});

describe('the odometer at an instant', () => {
  const car = { startKm: 1_000, readings: [{ at: at('2026-09-10T00:00:00Z'), km: 1_500 }, { at: at('2026-10-10T00:00:00Z'), km: 2_100 }] };
  it('is the last reading at or before it, or the start of the car', () => {
    expect(kmAt(car, at('2026-09-09T00:00:00Z'))).toBe(1_000);
    expect(kmAt(car, at('2026-09-10T00:00:00Z'))).toBe(1_500);
    expect(kmAt(car, at('2026-10-31T00:00:00Z'))).toBe(2_100);
  });
});

describe('the report', () => {
  const NOW = at('2026-10-31T10:00:00.000Z');
  const car = (id: string, plate: string, contractNumber: string, startKm: number, readings: ReportVehicle['readings'], spans: ReportVehicle['spans'] = []): ReportVehicle => ({ id, plate, model: 'Fiat Egea', contractNumber, startKm, readings, spans });
  // Ayşe (Satış) has car A from 1 September; car B is nobody's; contract SZL-2 has no car.
  const A = car('a', '35 FLM 101', 'SZL-1', 1_000, [{ at: at('2026-08-31T12:00:00Z'), km: 1_000 }, { at: at('2026-09-30T12:00:00Z'), km: 1_600 }, { at: at('2026-10-30T12:00:00Z'), km: 2_100 }], [{ employeeId: 'ayse', department: 'Satış', startedAt: at('2026-09-01T00:00:00Z'), endedAt: null }]);
  const B = car('b', '35 FLM 102', 'SZL-1', 500, [{ at: at('2026-10-15T12:00:00Z'), km: 900 }]);
  const invoices = [
    { period: '2026-09', lines: [{ contractNumber: 'SZL-1', amount: 1_001 }, { contractNumber: 'SZL-2', amount: 300 }] },
    { period: '2026-10', lines: [{ contractNumber: 'SZL-1', amount: 2_000 }] },
    { period: '2026-07', lines: [{ contractNumber: 'SZL-1', amount: 9_999 }] },
  ];
  const expenses = [
    { vehicleId: 'a', occurredAt: at('2026-09-12T08:00:00Z'), amount: 500 },
    { vehicleId: 'a', occurredAt: at('2026-10-02T08:00:00Z'), amount: 700 },
    { vehicleId: 'b', occurredAt: at('2026-10-03T08:00:00Z'), amount: 250 },
    { vehicleId: 'a', occurredAt: at('2026-06-01T08:00:00Z'), amount: 4_444 },
  ];
  const report = buildReport({ from: '2026-09', to: '2026-10', vehicles: [B, A], invoices, expenses, now: NOW });

  it('counts only the months asked for', () => {
    expect(report.months.map((m) => m.period)).toEqual(['2026-09', '2026-10']);
    expect(report.totals.invoice).toBe(1_001 + 300 + 2_000);
    expect(report.totals.expenses).toBe(500 + 700 + 250);
    expect(report.totals.total).toBe(report.totals.invoice + report.totals.expenses);
  });

  it('adds up the same by month, by car and by department, to the kuruş', () => {
    const sum = (rows: Array<{ invoice: number; expenses: number; total: number; km: number }>, key: 'invoice' | 'expenses' | 'total' | 'km') => rows.reduce((s, r) => s + r[key], 0);
    for (const key of ['invoice', 'expenses', 'total', 'km'] as const) {
      expect(sum(report.months, key)).toBe(report.totals[key]);
      expect(sum(report.departments, key)).toBe(report.totals[key]);
    }
    // The cars carry everything but what no car could carry.
    expect(sum(report.vehicles, 'invoice') + report.unallocated.invoice).toBe(report.totals.invoice);
    expect(sum(report.vehicles, 'expenses')).toBe(report.totals.expenses);
    expect(sum(report.vehicles, 'km')).toBe(report.totals.km);
  });

  it('shares a line between the cars of its contract, the extra kuruş to the first plate; a contract with no car is unallocated', () => {
    const a = report.vehicles.find((v) => v.id === 'a')!;
    const b = report.vehicles.find((v) => v.id === 'b')!;
    expect(a.invoice).toBe(501 + 1_000);
    expect(b.invoice).toBe(500 + 1_000);
    expect(report.unallocated.invoice).toBe(300);
  });

  it('puts a cost in the department of the person who had the car then, and the rest in none', () => {
    const sales = report.departments.find((d) => d.department === 'Satış')!;
    // Car A had Ayşe from 1 September: both invoice shares of the car and both of its expenses are hers; car B and the loose line are nobody's.
    expect(sales.invoice).toBe(501 + 1_000);
    expect(sales.expenses).toBe(500 + 700);
    const none = report.departments.find((d) => d.department === null)!;
    expect(none.invoice).toBe(500 + 1_000 + 300);
    expect(none.expenses).toBe(250);
  });

  it('counts the kilometres of a month as the odometer at its end less the odometer at its start', () => {
    expect(report.months.map((m) => m.km)).toEqual([600 + 0, 500 + 400]);
    expect(report.vehicles.find((v) => v.id === 'a')!.km).toBe(1_100);
    expect(report.vehicles.find((v) => v.id === 'b')!.km).toBe(400);
    expect(report.totals.km).toBe(1_500);
  });

  it('is empty, not broken, when nothing happened', () => {
    const empty = buildReport({ from: '2026-01', to: '2026-02', vehicles: [A], invoices: [], expenses: [], now: NOW });
    expect(empty.totals).toEqual({ invoice: 0, expenses: 0, total: 0, km: 0 });
    expect(empty.vehicles).toEqual([]);
    expect(empty.departments).toEqual([]);
    expect(empty.months).toHaveLength(2);
  });
});
