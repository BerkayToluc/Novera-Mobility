import { Inject, Injectable } from '@nestjs/common';
import type { Page } from '../admin/admin-list.js';
import { pageFields, sortField } from '../admin/admin-list.js';
import { month } from '../admin/invoices/invoices.schemas.js';
import { istanbulDay } from '../common/time.js';
import { parseInput } from '../common/zod-validation.js';
import { field } from '../common/zod-fields.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { z } from 'zod';
import { parseDay } from './fleet-dates.js';
import { fleetNotFound } from './fleet.errors.js';
import { INVOICE_INCLUDE, invoiceView, normalizeInvoiceNumber, type InvoiceView } from './invoice.view.js';

const listFleetInvoiceSchema = z.object({
  ...pageFields,
  // The month it is for, newest first.
  sort: sortField(['period', 'dueAt', 'total'] as const, { field: 'period', direction: 'desc' }),
  period: field<string | null>((raw) => (raw === undefined || raw === null || raw === '' ? { value: null } : month(raw))),
  status: field<'PAID' | 'PENDING' | 'OVERDUE' | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return raw === 'PAID' || raw === 'PENDING' || raw === 'OVERDUE' ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
});

// The invoices of the signed-in company (V2-37, docs/FLEET.md §4.1). Every query takes the company and filters by it first: an invoice of
// another company is never found, so it is a 404 like one that does not exist (ADR-25).
@Injectable()
export class FleetInvoicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, query: unknown, now: Date = new Date()): Promise<Page<InvoiceView>> {
    const input = parseInput(listFleetInvoiceSchema, query, 'Invoice list query is invalid');
    const today = parseDay(istanbulDay(now).date)!;
    const where: Prisma.FleetInvoiceWhereInput = {
      companyId,
      ...(input.period ? { period: input.period } : {}),
      ...(input.status === 'PAID' ? { paidAt: { not: null } } : input.status === 'PENDING' ? { paidAt: null, dueAt: { gte: today } } : input.status === 'OVERDUE' ? { paidAt: null, dueAt: { lt: today } } : {}),
    };
    const { field: by, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.fleetInvoice.count({ where }),
      this.prisma.fleetInvoice.findMany({ where, include: INVOICE_INCLUDE, orderBy: [{ [by]: direction }, { id: 'asc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    ]);
    return { items: rows.map((row) => invoiceView(row, today)), total, page: input.page, pageSize: input.pageSize };
  }

  async get(companyId: string, rawNumber: string, now: Date = new Date()): Promise<InvoiceView> {
    const number = normalizeInvoiceNumber(rawNumber);
    if (!number) throw fleetNotFound('Invoice');
    const row = await this.prisma.fleetInvoice.findFirst({ where: { companyId, number }, include: INVOICE_INCLUDE });
    if (!row) throw fleetNotFound('Invoice');
    return invoiceView(row, parseDay(istanbulDay(now).date)!);
  }
}
