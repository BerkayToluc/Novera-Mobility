import { Inject, Injectable } from '@nestjs/common';
import { istanbulDay } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { addDays, parseDay } from './fleet-dates.js';
import { invoiceStatus, type InvoiceStatus } from './invoice-calc.js';

// The days ahead the cards of the summary look (FLEET.md §3): a contract that ends within 60 days, a car whose maintenance or
// inspection is within 30.
export const CONTRACT_ENDING_DAYS = 60;
export const MAINTENANCE_DUE_DAYS = 30;

export type FleetSummary = {
  // The Istanbul day the numbers are for.
  date: string;
  // Whether the company has an active contract: the Filom link and the screens show only then.
  hasActiveContract: boolean;
  vehicles: { total: number; assigned: number; idle: number };
  contracts: { active: number; endingSoon: number };
  // Cars whose maintenance or inspection date is within 30 days, or already past.
  maintenanceDue: number;
  // The invoices (V2-37): this month's, and what is still to be paid (the late ones counted too).
  invoices: {
    thisMonth: { number: string; total: number; status: InvoiceStatus } | null;
    unpaid: { count: number; total: number };
    overdue: number;
  };
};

// The numbers on the summary of the fleet panel (V2-35). The cards of invoices, expenses and requests are added by the issues that
// make them (V2-37, V2-38, V2-41).
@Injectable()
export class FleetSummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(companyId: string, now: Date = new Date()): Promise<FleetSummary> {
    const day = istanbulDay(now);
    const today = parseDay(day.date)!;
    const [activeContracts, endingSoon, total, assigned, maintenanceDue, thisMonth, unpaid, overdue] = await Promise.all([
      this.prisma.fleetContract.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.fleetContract.count({ where: { companyId, status: 'ACTIVE', endAt: { lte: addDays(today, CONTRACT_ENDING_DAYS) } } }),
      this.prisma.fleetVehicle.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.fleetVehicle.count({ where: { companyId, status: 'ACTIVE', assignments: { some: { endedAt: null } } } }),
      this.prisma.fleetVehicle.count({
        where: {
          companyId,
          status: 'ACTIVE',
          OR: [{ nextMaintenanceOn: { lte: addDays(today, MAINTENANCE_DUE_DAYS) } }, { inspectionDueOn: { lte: addDays(today, MAINTENANCE_DUE_DAYS) } }],
        },
      }),
      this.prisma.fleetInvoice.findFirst({ where: { companyId, period: day.date.slice(0, 7) } }),
      this.prisma.fleetInvoice.aggregate({ where: { companyId, paidAt: null }, _count: true, _sum: { total: true } }),
      this.prisma.fleetInvoice.count({ where: { companyId, paidAt: null, dueAt: { lt: today } } }),
    ]);
    return {
      date: day.date,
      hasActiveContract: activeContracts > 0,
      vehicles: { total, assigned, idle: total - assigned },
      contracts: { active: activeContracts, endingSoon },
      maintenanceDue,
      invoices: {
        thisMonth: thisMonth ? { number: thisMonth.number, total: thisMonth.total, status: invoiceStatus(thisMonth, today) } : null,
        unpaid: { count: unpaid._count, total: unpaid._sum.total ?? 0 },
        overdue,
      },
    };
  }
}
