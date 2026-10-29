import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { normalizePromoCode } from '../reservations/reservation-input.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageOf, type Page } from './admin-list.js';
import { inUse, staleWrite } from './admin.errors.js';
import { createPromoSchema, listPromoSchema, updatePromoSchema } from './promo-codes.schemas.js';
import { NO_USAGE, promoCodeView, type PromoCodeView, type PromoUsage } from './promo-codes.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Campaign code not found' }, HttpStatus.NOT_FOUND);

// Another code already has this name. It is a 409 like a taken e-mail address, with the field named.
const codeTaken = (): HttpException =>
  new HttpException(
    { code: 'CODE_TAKEN', message: 'A campaign code with this name already exists', fieldErrors: { code: 'CODE_TAKEN' } },
    HttpStatus.CONFLICT,
  );

type Reservations = Pick<PrismaService, 'reservation'>;

// A period has to end after it starts; either end may be missing (no limit).
function assertDateOrder(validFrom: Date | null, validUntil: Date | null): void {
  if (validFrom && validUntil && validUntil.getTime() <= validFrom.getTime()) {
    throw validationFailed({ validUntil: 'INVALID_DATE_RANGE' }, 'A campaign code must end after it starts');
  }
}

// What the bookings say about each code: how many still hold it (not cancelled) and how many ever did. One query for
// all codes, or for one.
async function usageOf(db: Reservations, code?: string): Promise<Map<string, PromoUsage>> {
  const groups = await db.reservation.groupBy({
    by: ['promoCode', 'status'],
    where: code ? { promoCode: code } : { promoCode: { not: null } },
    _count: { _all: true },
  });
  const usage = new Map<string, PromoUsage>();
  for (const group of groups) {
    if (group.promoCode === null) continue;
    const entry = usage.get(group.promoCode) ?? { used: 0, ever: 0 };
    entry.ever += group._count._all;
    if (group.status === 'CONFIRMED') entry.used += group._count._all;
    usage.set(group.promoCode, entry);
  }
  return usage;
}

const compare = (a: number | string, b: number | string): number => (a < b ? -1 : a > b ? 1 : 0);

// The campaign codes of the administration (V2-26, ADMIN.md §3.1). The table is small and kept by hand, so a list
// reads it whole and filters, sorts and pages in memory: "used up" depends on the bookings, which a database filter
// would need a join for, and a few hundred rows are no cost.
@Injectable()
export class PromoCodesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown, now: Date = new Date()): Promise<Page<PromoCodeView>> {
    const input = parseInput(listPromoSchema, query, 'Campaign code list query is invalid');
    const [rows, usage] = await Promise.all([this.prisma.promoCode.findMany(), usageOf(this.prisma)]);
    let views = rows.map((row) => promoCodeView(row, usage.get(row.code) ?? NO_USAGE, now));

    const needle = normalizeSearch(input.q);
    if (needle) views = views.filter((view) => view.code.includes(needle));
    if (input.status) views = views.filter((view) => view.status === input.status);

    const { field: by, direction } = input.sort;
    const sign = direction === 'asc' ? 1 : -1;
    // A code with no end date sorts as the furthest one, so "ends last" puts the endless ones first.
    const key = (view: PromoCodeView): number | string =>
      by === 'validUntil' ? (view.validUntil ? Date.parse(view.validUntil) : Number.POSITIVE_INFINITY) : view[by];
    views.sort((a, b) => sign * compare(key(a), key(b)) || compare(a.code, b.code));
    return pageOf(views, input.page, input.pageSize);
  }

  async get(rawCode: string, now: Date = new Date()): Promise<PromoCodeView> {
    const code = codeOf(rawCode);
    const row = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!row) throw notFound();
    return promoCodeView(row, (await usageOf(this.prisma, code)).get(code) ?? NO_USAGE, now);
  }

  async create(body: unknown, now: Date = new Date()): Promise<PromoCodeView> {
    const input = parseInput(createPromoSchema, body, 'Campaign code validation failed');
    const validFrom = input.validFrom ?? null;
    const validUntil = input.validUntil ?? null;
    assertDateOrder(validFrom, validUntil);
    try {
      const row = await this.prisma.promoCode.create({
        data: {
          code: input.code,
          percent: input.percent,
          active: input.active ?? true,
          validFrom,
          validUntil,
          maxRedemptions: input.maxRedemptions ?? null,
          oncePerUser: input.oncePerUser ?? true,
        },
      });
      return promoCodeView(row, (await usageOf(this.prisma, row.code)).get(row.code) ?? NO_USAGE, now);
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken();
      throw error;
    }
  }

  // The code row is locked first, the way a booking locks it: a booking that is taking the last use of the code and
  // this change cannot both pass their checks. Only that one row is locked, so no lock can cross another.
  async update(rawCode: string, body: unknown, now: Date = new Date()): Promise<PromoCodeView> {
    const code = codeOf(rawCode);
    const input = parseInput(updatePromoSchema, body, 'Campaign code validation failed');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PromoCode" WHERE "code" = ${code} FOR UPDATE`;
      const current = await tx.promoCode.findUnique({ where: { code } });
      if (!current) throw notFound();
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();

      const validFrom = input.validFrom === undefined ? current.validFrom : input.validFrom;
      const validUntil = input.validUntil === undefined ? current.validUntil : input.validUntil;
      const maxRedemptions = input.maxRedemptions === undefined ? current.maxRedemptions : input.maxRedemptions;
      assertDateOrder(validFrom, validUntil);

      const usage = (await usageOf(tx, code)).get(code) ?? NO_USAGE;
      // A cap below what is already used would make the code "used up" with uses to spare.
      if (maxRedemptions !== null && maxRedemptions < usage.used) {
        throw validationFailed({ maxRedemptions: 'BELOW_USAGE' }, 'The cap is lower than the uses so far');
      }

      const row = await tx.promoCode.update({
        where: { code },
        data: {
          percent: input.percent,
          active: input.active,
          validFrom,
          validUntil,
          maxRedemptions,
          oncePerUser: input.oncePerUser,
        },
      });
      return promoCodeView(row, usage, now);
    });
  }

  // A code that is on any booking, cancelled or not, stays: the booking keeps its name and the history would lose it.
  // Nothing is changed by the refusal; the screen offers to switch the code off instead.
  async remove(rawCode: string): Promise<void> {
    const code = codeOf(rawCode);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PromoCode" WHERE "code" = ${code} FOR UPDATE`;
      const current = await tx.promoCode.findUnique({ where: { code } });
      if (!current) throw notFound();
      const usage = (await usageOf(tx, code)).get(code) ?? NO_USAGE;
      if (usage.ever > 0) throw inUse('The code is on bookings; switch it off instead of deleting it');
      await tx.promoCode.delete({ where: { code } });
    });
  }
}

// A code in an address, as the booking form reads it. Something that cannot be a code is a code that does not exist.
function codeOf(raw: string): string {
  const code = normalizePromoCode(raw);
  if (!code) throw notFound();
  return code;
}

function normalizeSearch(raw: string | null): string {
  return raw ? raw.toLocaleUpperCase('en').replace(/\s+/g, '') : '';
}

