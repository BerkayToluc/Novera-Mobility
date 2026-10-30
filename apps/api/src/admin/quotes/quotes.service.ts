import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { parseInput } from '../../common/zod-validation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Page } from '../admin-list.js';
import { invalidTransition, staleWrite } from '../admin.errors.js';
import { listQuoteSchema, updateQuoteSchema } from './quotes.schemas.js';
import { normalizeQuoteNumber, QUOTE_INCLUDE, quoteDetail, quoteListItem, statusRank, type QuoteDetail, type QuoteListItem } from './quotes.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Quote request not found' }, HttpStatus.NOT_FOUND);

// The corporate quote requests of the administration (V2-32, ADMIN.md §3.2). They keep coming in, so the list is a database
// query: the filters, the order and the page are the database's.
@Injectable()
export class AdminQuotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<QuoteListItem>> {
    const input = parseInput(listQuoteSchema, query, 'Quote list query is invalid');
    const where: Prisma.QuoteRequestWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.q
        ? {
            OR: [
              { number: { contains: input.q, mode: 'insensitive' } },
              { companyName: { contains: input.q, mode: 'insensitive' } },
              { email: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.quoteRequest.count({ where }),
      this.prisma.quoteRequest.findMany({
        where,
        include: QUOTE_INCLUDE,
        // The id as the last key: requests that share a value still come in one order, so a page never repeats or skips one.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(quoteListItem), total, page: input.page, pageSize: input.pageSize };
  }

  async get(rawNumber: string): Promise<QuoteDetail> {
    const number = this.numberOf(rawNumber);
    const row = await this.prisma.quoteRequest.findUnique({ where: { number }, include: QUOTE_INCLUDE });
    if (!row) throw notFound();
    return quoteDetail(row);
  }

  // The state and the note. The row is locked first: two edits take turns, and the second sees the new version and is refused.
  // The state only moves forward (RECEIVED, IN_REVIEW, OFFERED, CLOSED; skipping ahead is fine); going back is
  // `409 INVALID_TRANSITION` and nothing is written. Asking for the state it is already in changes nothing and is no error.
  async update(rawNumber: string, body: unknown): Promise<QuoteDetail> {
    const number = this.numberOf(rawNumber);
    const input = parseInput(updateQuoteSchema, body, 'Quote validation failed');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "QuoteRequest" WHERE "number" = ${number} FOR UPDATE`;
      const current = await tx.quoteRequest.findUnique({ where: { number }, include: QUOTE_INCLUDE });
      if (!current) throw notFound();
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();
      if (input.status !== undefined && statusRank(input.status) < statusRank(current.status)) {
        throw invalidTransition(`A quote request cannot go back from ${current.status} to ${input.status}`);
      }

      const status = input.status !== undefined && input.status !== current.status ? input.status : undefined;
      if (status === undefined && input.internalNote === undefined) return quoteDetail(current);
      const row = await tx.quoteRequest.update({
        where: { number },
        data: { status, internalNote: input.internalNote },
        include: QUOTE_INCLUDE,
      });
      return quoteDetail(row);
    });
  }

  // A number in the path, as it is stored: capitals. Something that cannot be a number is a request that does not exist.
  private numberOf(raw: string): string {
    const number = normalizeQuoteNumber(raw);
    if (!number) throw notFound();
    return number;
  }
}
