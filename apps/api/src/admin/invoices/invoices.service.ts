import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { istanbulDay } from '../../common/time.js';
import { parseInput, validationFailed } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { parseDay } from '../../fleet/fleet-dates.js';
import { dueDayOf, lineOf, periodRange, totalsOf, type InvoiceLine } from '../../fleet/invoice-calc.js';
import { INVOICE_INCLUDE, invoiceView, normalizeInvoiceNumber, type InvoiceView } from '../../fleet/invoice.view.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Page } from '../admin-list.js';
import { alreadyGenerated, staleWrite } from '../admin.errors.js';
import { generateInvoicesSchema, listInvoiceSchema, updateInvoiceSchema } from './invoices.schemas.js';

const notFound = (): HttpException => new HttpException({ code: 'NOT_FOUND', message: 'Invoice not found' }, HttpStatus.NOT_FOUND);

export type GenerateResult = { period: string; created: number; invoices: InvoiceView[] };

// The invoices of the administration (V2-37, docs/ADMIN.md §3.15): making a month's invoices for every company that has a contract in it,
// listing them, and marking one paid. The rule for the amounts is in fleet/invoice-calc.ts. Money is TRY kuruş.
@Injectable()
export class InvoicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private today(now: Date): Date {
    return parseDay(istanbulDay(now).date)!;
  }

  // One invoice for each company that has a contract that touches the month, made at once. The month's invoices are made together or not
  // at all, and only once: the month is locked while it is made, and a second call (or a call that arrives at the same moment) finds
  // them and is refused with `409 ALREADY_GENERATED` without changing anything. A month that has not started cannot be billed.
  async generate(query: unknown, now: Date = new Date()): Promise<GenerateResult> {
    const { period } = parseInput(generateInvoicesSchema, query, 'Invoice period is invalid');
    if (!period) throw validationFailed({ period: 'REQUIRED' }, 'The period is required');
    const range = periodRange(period)!;
    const day = istanbulDay(now);
    const today = this.today(now);
    if (range.start.getTime() > today.getTime()) throw validationFailed({ period: 'OUT_OF_RANGE' }, 'A month that has not started cannot be billed');

    return this.prisma.$transaction(async (tx) => {
      // The lock lasts until the transaction ends, so two calls for one month take turns and the second sees the first one's invoices.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'fleet-invoices:' + period}))`;
      if ((await tx.fleetInvoice.count({ where: { period } })) > 0) throw alreadyGenerated(period);

      const contracts = await tx.fleetContract.findMany({
        where: { startAt: { lte: range.end }, endAt: { gte: range.start } },
        include: { product: { select: { slug: true } } },
        orderBy: [{ companyId: 'asc' }, { number: 'asc' }],
      });
      const byCompany = new Map<string, InvoiceLine[]>();
      for (const contract of contracts) {
        const line = lineOf({ number: contract.number, productSlug: contract.product.slug, monthlyFee: contract.monthlyFee, startAt: contract.startAt, endAt: contract.endAt }, range);
        if (line) byCompany.set(contract.companyId, [...(byCompany.get(contract.companyId) ?? []), line]);
      }

      const created: InvoiceView[] = [];
      for (const [companyId, lines] of byCompany) {
        const { subtotal, vat, total } = totalsOf(lines);
        const [{ serial }] = await tx.$queryRaw<{ serial: bigint }[]>`SELECT nextval('"FleetInvoiceNumber_seq"') AS serial`;
        const issuedAt = parseDay(day.date)!;
        const row = await tx.fleetInvoice.create({
          data: {
            number: `FTR-${day.date.slice(0, 4)}-${String(serial).padStart(5, '0')}`,
            companyId,
            period,
            issuedAt,
            dueAt: parseDay(dueDayOf(issuedAt))!,
            lines: lines as unknown as Prisma.InputJsonValue,
            subtotal,
            vat,
            total,
          },
          include: INVOICE_INCLUDE,
        });
        created.push(invoiceView(row, today));
      }
      return { period, created: created.length, invoices: created };
    });
  }

  async list(query: unknown, now: Date = new Date()): Promise<Page<InvoiceView>> {
    const input = parseInput(listInvoiceSchema, query, 'Invoice list query is invalid');
    const today = this.today(now);
    const where: Prisma.FleetInvoiceWhereInput = {
      ...(input.period ? { period: input.period } : {}),
      ...(input.company ? { companyId: input.company } : {}),
      // "Late" is not stored: not paid, and the due day is before today.
      ...(input.status === 'PAID' ? { paidAt: { not: null } } : input.status === 'PENDING' ? { paidAt: null, dueAt: { gte: today } } : input.status === 'OVERDUE' ? { paidAt: null, dueAt: { lt: today } } : {}),
      ...(input.q ? { OR: [{ number: { contains: input.q, mode: 'insensitive' } }, { company: { is: { name: { contains: input.q, mode: 'insensitive' } } } }] } : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.fleetInvoice.count({ where }),
      this.prisma.fleetInvoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        // The id as the last key: invoices that share a value still come in one order, so a page never repeats or skips one.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map((row) => invoiceView(row, today)), total, page: input.page, pageSize: input.pageSize };
  }

  async get(rawNumber: string, now: Date = new Date()): Promise<InvoiceView> {
    const number = normalizeInvoiceNumber(rawNumber);
    if (!number) throw notFound();
    const row = await this.prisma.fleetInvoice.findUnique({ where: { number }, include: INVOICE_INCLUDE });
    if (!row) throw notFound();
    return invoiceView(row, this.today(now));
  }

  // The paid mark and taking it back. The row is locked, so two edits take turns and the second is refused (`409 STALE_WRITE`) if it was
  // made against an older copy. Asking for the state it is in already changes nothing and is no error. The date is when it was marked.
  async update(rawNumber: string, body: unknown, now: Date = new Date()): Promise<InvoiceView> {
    const number = normalizeInvoiceNumber(rawNumber);
    if (!number) throw notFound();
    const input = parseInput(updateInvoiceSchema, body, 'Invoice validation failed');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FleetInvoice" WHERE "number" = ${number} FOR UPDATE`;
      const current = await tx.fleetInvoice.findUnique({ where: { number }, include: INVOICE_INCLUDE });
      if (!current) throw notFound();
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();
      if ((current.paidAt !== null) === input.paid) return invoiceView(current, this.today(now));
      const row = await tx.fleetInvoice.update({ where: { number }, data: { paidAt: input.paid ? now : null }, include: INVOICE_INCLUDE });
      return invoiceView(row, this.today(now));
    });
  }
}

