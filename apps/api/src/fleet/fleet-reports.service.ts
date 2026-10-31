import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { istanbulDay } from '../common/time.js';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { field } from '../common/zod-fields.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildReport, isMonth, monthsBetween, monthStart, nextMonth, MAX_REPORT_MONTHS, type Report } from './report-calc.js';
import { readLines } from './invoice.view.js';

// A month as people write it, "2026-10"; missing is the month asked for by the other end, or this month.
const monthQuery = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return typeof raw === 'string' && isMonth(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
});
const reportQuerySchema = z.object({ from: monthQuery, to: monthQuery });

// The report of the signed-in company (V2-39, docs/FLEET.md §3.1, §4.1): what it spent and drove in a run of months, by month, car and
// department. Every query takes the company first (ADR-25). The rules for sharing the invoices out are in report-calc.ts.
@Injectable()
export class FleetReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(companyId: string, query: unknown, now: Date = new Date()): Promise<Report> {
    const input = parseInput(reportQuerySchema, query, 'Report query is invalid');
    const thisMonth = istanbulDay(now).date.slice(0, 7);
    const to = input.to ?? input.from ?? thisMonth;
    const from = input.from ?? to;
    // Months that have not started have nothing in them; a report for them is a mistake, not an empty report.
    if (to > thisMonth) throw validationFailed({ to: 'OUT_OF_RANGE' }, 'A month that has not started has no report');
    if (from > to) throw validationFailed({ from: 'OUT_OF_RANGE' }, 'The first month is after the last');
    if (monthsBetween(from, to).length > MAX_REPORT_MONTHS) throw validationFailed({ from: 'OUT_OF_RANGE' }, `A report covers at most ${MAX_REPORT_MONTHS} months`);

    const start = monthStart(from);
    const end = monthStart(nextMonth(to));
    const [vehicles, invoices, expenses] = await Promise.all([
      this.prisma.fleetVehicle.findMany({
        where: { companyId },
        select: {
          id: true,
          plate: true,
          startKm: true,
          contract: { select: { number: true } },
          vehicleModel: { select: { brand: true, model: true } },
          assignments: { select: { employeeId: true, startedAt: true, endedAt: true, employee: { select: { department: true } } } },
          readings: { where: { at: { lt: end } }, select: { at: true, km: true } },
        },
      }),
      this.prisma.fleetInvoice.findMany({ where: { companyId, period: { gte: from, lte: to } }, select: { period: true, lines: true } }),
      this.prisma.fleetExpense.findMany({ where: { companyId, occurredAt: { gte: start, lt: end } }, select: { fleetVehicleId: true, occurredAt: true, amount: true } }),
    ]);

    return buildReport({
      from,
      to,
      now,
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        plate: vehicle.plate,
        model: `${vehicle.vehicleModel.brand} ${vehicle.vehicleModel.model}`,
        contractNumber: vehicle.contract.number,
        startKm: vehicle.startKm,
        readings: vehicle.readings,
        spans: vehicle.assignments.map((span) => ({ employeeId: span.employeeId, department: span.employee.department, startedAt: span.startedAt, endedAt: span.endedAt })),
      })),
      invoices: invoices.map((invoice) => ({ period: invoice.period, lines: readLines(invoice.lines).map((line) => ({ contractNumber: line.contractNumber, amount: line.amount })) })),
      expenses: expenses.map((expense) => ({ vehicleId: expense.fleetVehicleId, occurredAt: expense.occurredAt, amount: expense.amount })),
    });
  }
}
