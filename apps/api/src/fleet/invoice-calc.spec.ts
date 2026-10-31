import { parseDay } from './fleet-dates.js';
import { billableDays, DUE_DAYS, dueDayOf, invoiceStatus, lineOf, periodRange, proRate, totalsOf, VAT_PERCENT } from './invoice-calc.js';

// The rule for a monthly invoice (V2-37, docs/ADMIN.md §3.15), without a database.
const day = (value: string) => parseDay(value)!;
const range = (period: string) => periodRange(period)!;
const contract = (startAt: string, endAt: string, monthlyFee = 3_100_000) => ({ number: 'SZL-2026-00001', productSlug: 'akilli-kurumsal-filo', monthlyFee, startAt: day(startAt), endAt: day(endAt) });

describe('the month of an invoice', () => {
  it('has its first and last day and the days it has, leap years included', () => {
    expect(range('2026-10')).toMatchObject({ daysInMonth: 31 });
    expect(range('2026-10').start).toEqual(day('2026-10-01'));
    expect(range('2026-10').end).toEqual(day('2026-10-31'));
    expect(range('2026-11').daysInMonth).toBe(30);
    expect(range('2026-02').daysInMonth).toBe(28);
    expect(range('2028-02').daysInMonth).toBe(29);
    expect(range('2026-12').end).toEqual(day('2026-12-31'));
  });

  it('is nothing for what is not a month', () => {
    for (const bad of ['2026-13', '2026-00', '2026-1', '26-10', '2026-10-01', '', 'abc']) expect([bad, periodRange(bad)]).toEqual([bad, null]);
  });
});

describe('the days a contract is billed for', () => {
  const october = range('2026-10');

  it('are the days it covers in the month, both end days included', () => {
    expect(billableDays(contract('2026-01-01', '2026-12-31'), october)).toBe(31);
    // Starts on the 16th: the 16th to the 31st is 16 days.
    expect(billableDays(contract('2026-10-16', '2027-10-15'), october)).toBe(16);
    // Ends on the 10th: the 1st to the 10th is 10 days.
    expect(billableDays(contract('2026-01-01', '2026-10-10'), october)).toBe(10);
    // Starts and ends inside the month.
    expect(billableDays(contract('2026-10-10', '2026-10-20'), october)).toBe(11);
    // A single day.
    expect(billableDays(contract('2026-10-31', '2026-12-31'), october)).toBe(1);
    expect(billableDays(contract('2026-09-01', '2026-10-01'), october)).toBe(1);
  });

  it('are none when the contract does not touch the month', () => {
    expect(billableDays(contract('2026-11-01', '2027-10-31'), october)).toBe(0);
    expect(billableDays(contract('2025-01-01', '2026-09-30'), october)).toBe(0);
  });
});

describe('the amount of a line', () => {
  it('is the monthly fee for a whole month, exactly', () => {
    expect(proRate(3_100_000, 31, 31)).toBe(3_100_000);
    expect(proRate(1_234_567, 30, 30)).toBe(1_234_567);
  });

  it('is the fee for the days out of the days of the month, rounded half up to the kuruş', () => {
    expect(proRate(3_100_000, 16, 31)).toBe(1_600_000);
    // 100 kuruş × 1 ÷ 3 = 33.33 → 33; × 2 ÷ 3 = 66.67 → 67.
    expect(proRate(100, 1, 3)).toBe(33);
    expect(proRate(100, 2, 3)).toBe(67);
    // Exactly half goes up: 1 kuruş × 1 ÷ 2 = 0.5 → 1.
    expect(proRate(1, 1, 2)).toBe(1);
    expect(proRate(5, 1, 2)).toBe(3);
  });

  it('a line carries the contract, the product, the days and the amount; a contract that is not in the month has none', () => {
    const line = lineOf(contract('2026-10-16', '2027-10-15'), range('2026-10'));
    expect(line).toEqual({ contractNumber: 'SZL-2026-00001', productSlug: 'akilli-kurumsal-filo', days: 16, daysInMonth: 31, amount: 1_600_000 });
    expect(lineOf(contract('2026-11-01', '2027-10-31'), range('2026-10'))).toBeNull();
  });
});

describe('the totals of an invoice', () => {
  it('are the sum of the lines, VAT at 20 % of it, and the two together', () => {
    expect(VAT_PERCENT).toBe(20);
    expect(totalsOf([{ amount: 3_100_000 }, { amount: 1_000_000 }])).toEqual({ subtotal: 4_100_000, vat: 820_000, total: 4_920_000 });
    expect(totalsOf([])).toEqual({ subtotal: 0, vat: 0, total: 0 });
  });

  it('round the VAT half up to the kuruş, and the total is always the subtotal and the VAT exactly', () => {
    // 20 % of 2 kuruş = 0.4 → 0; of 3 = 0.6 → 1; of 5 = 1 exactly; of 7 = 1.4 → 1; of 8 = 1.6 → 2.
    expect(totalsOf([{ amount: 2 }]).vat).toBe(0);
    expect(totalsOf([{ amount: 3 }]).vat).toBe(1);
    expect(totalsOf([{ amount: 5 }]).vat).toBe(1);
    expect(totalsOf([{ amount: 7 }]).vat).toBe(1);
    expect(totalsOf([{ amount: 8 }]).vat).toBe(2);
    for (const amount of [1, 2, 3, 99, 12_345, 999_999_999]) {
      const { subtotal, vat, total } = totalsOf([{ amount }]);
      expect(subtotal).toBe(amount);
      expect(total).toBe(subtotal + vat);
    }
  });

  it('the lines of several contracts add up to the invoice to the kuruş, whatever each was rounded to', () => {
    const october = range('2026-10');
    const lines = [contract('2026-10-03', '2027-10-02', 1_234_567), contract('2026-10-10', '2027-10-09', 987_653), contract('2026-01-01', '2026-10-20', 555_551)].map((c, index) => lineOf({ ...c, number: `SZL-2026-0000${index + 1}` }, october)!);
    const { subtotal, total, vat } = totalsOf(lines);
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(subtotal);
    expect(total).toBe(subtotal + vat);
  });
});

describe('the state of an invoice', () => {
  const today = day('2026-10-31');

  it('is paid when it has a paid date, whatever the due day', () => {
    expect(invoiceStatus({ paidAt: new Date(), dueAt: day('2026-01-01') }, today)).toBe('PAID');
  });

  it('is late the day after the due day, and waiting until then (the due day itself is not late)', () => {
    expect(invoiceStatus({ paidAt: null, dueAt: day('2026-11-15') }, today)).toBe('PENDING');
    expect(invoiceStatus({ paidAt: null, dueAt: day('2026-10-31') }, today)).toBe('PENDING');
    expect(invoiceStatus({ paidAt: null, dueAt: day('2026-10-30') }, today)).toBe('OVERDUE');
  });

  it('is due 30 days after it was issued', () => {
    expect(DUE_DAYS).toBe(30);
    expect(dueDayOf(day('2026-10-31'))).toBe('2026-11-30');
    expect(dueDayOf(day('2026-12-15'))).toBe('2027-01-14');
  });
});
