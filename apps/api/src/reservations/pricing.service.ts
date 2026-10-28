import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { unauthenticated } from '../auth/auth.errors.js';
import type { UserRow } from '../auth/user-view.js';
import { validationFailed } from '../forms/form-input.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadPointsLedger } from './points-balance.js';
import { pointsWorthMinor, redeemablePoints } from './points.rules.js';
import { DAY_MS } from '../common/time.js';
import {
  parseReservationRequest,
  type CurrencyCode,
  type ValidReservationRequest,
} from './reservation-input.js';

// POST /reservations/price: rezervasyon oluşturmadan kalem kalem fiyat (openapi.yaml PriceBreakdown).
// Kural (ADR-15, openapi): birim fiyat ÖNCE hedef para birimine çevrilip yuvarlanır, SONRA adet/günle
// çarpılır; böylece kalemlerin toplamı `total`'a tam eşit olur.

// Veritabanında kur yoksa kullanılan yedek değerler (CatalogService ile aynı).
const FALLBACK_RATES: Record<CurrencyCode, number> = { TRY: 1, EUR: 0.02, USD: 0.023 };

export interface Money {
  amount: number;
  currency: CurrencyCode;
}
interface Localized {
  tr: string;
  en: string;
}
export interface PriceLine {
  // DISCOUNT is a campaign code taken off: one line, last, with a negative amount, so the lines still add up to `total`.
  type: 'VEHICLE' | 'EXTRA' | 'DISCOUNT';
  // The model's slug on the vehicle line, the extra's slug on an extra line, the code on a discount line, so a
  // client can match a line to what it chose without comparing the printed label.
  slug: string;
  label: Localized;
  quantity: number;
  unitPrice: Money;
  total: Money;
}
export interface PriceBreakdown {
  currency: CurrencyCode;
  exchangeRate: number;
  days: number;
  lines: PriceLine[];
  // The lines added up: car and extras minus the campaign code, before points.
  total: Money;
  // The code that was sent and whether it took anything off; null when no code was sent.
  promo: { code: string; applied: boolean; percent: number | null } | null;
  // Points paid with (0 when not used) and what is left to pay in money after them.
  pointsUsed: number;
  payable: Money;
}

// Veritabanı erişiminin fiyat için gereken kısmı (hem PrismaService hem işlem içi `tx` uyar).
export type PricingDb = Pick<PrismaService, 'vehicle' | 'extra' | 'exchangeRate' | 'promoCode' | 'reservation'>;
export type ConflictDb = Pick<PrismaService, 'reservation' | 'hold'>;

// Gün sayısı: ceil((bitiş - başlangıç) / 24 saat), en az 1.
export function rentalDays(startAt: Date, endAt: Date): number {
  return Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS));
}

// TRY kuruşunu hedef para biriminin alt birimine çevirir.
// Paying with points needs a signed-in individual account and a lira reservation.
export function requirePointsAccount(user: UserRow | null, currency: CurrencyCode): UserRow {
  if (!user) throw unauthenticated();
  if (user.accountType !== 'INDIVIDUAL' || currency !== 'TRY') {
    throw validationFailed({ usePoints: 'NOT_ALLOWED' }, 'Points can only be used by individual accounts, in TRY');
  }
  return user;
}

// Spends as many points as allowed (balance and the half-of-total cap) on a calculated price.
export function withPoints(breakdown: PriceBreakdown, balance: number): PriceBreakdown {
  const pointsUsed = redeemablePoints(balance, breakdown.total.amount);
  return {
    ...breakdown,
    pointsUsed,
    payable: { amount: breakdown.total.amount - pointsWorthMinor(pointsUsed), currency: breakdown.currency },
  };
}

// A code works when it is on and now is inside its dates (a missing date is no limit).
export function isPromoUsable(
  code: { active: boolean; validFrom: Date | null; validUntil: Date | null },
  now: Date,
): boolean {
  if (!code.active) return false;
  if (code.validFrom && now.getTime() < code.validFrom.getTime()) return false;
  if (code.validUntil && now.getTime() >= code.validUntil.getTime()) return false;
  return true;
}

// Why a code that exists and is switched on still cannot be used right now, or null when it can (V2-05, QUALITY G-04).
// Redemptions are counted from the bookings that were not cancelled, so a cancelled booking gives the code back.
export type PromoBlock = 'EXHAUSTED' | 'ALREADY_USED';
export async function promoBlock(
  db: Pick<PrismaService, 'reservation'>,
  code: { code: string; maxRedemptions: number | null; oncePerUser: boolean },
  userId: string | null,
): Promise<PromoBlock | null> {
  if (code.maxRedemptions !== null) {
    const used = await db.reservation.count({ where: { promoCode: code.code, status: 'CONFIRMED' } });
    if (used >= code.maxRedemptions) return 'EXHAUSTED';
  }
  if (code.oncePerUser && userId !== null) {
    const mine = await db.reservation.count({ where: { promoCode: code.code, userId, status: 'CONFIRMED' } });
    if (mine > 0) return 'ALREADY_USED';
  }
  return null;
}

export function convertMinor(tryMinor: number, rate: number, currency: CurrencyCode): number {
  return currency === 'TRY' ? tryMinor : Math.round(tryMinor * rate);
}

export function vehicleUnavailable(): HttpException {
  return new HttpException(
    {
      code: 'VEHICLE_UNAVAILABLE',
      message: 'The vehicle is not available for the requested period',
    },
    HttpStatus.CONFLICT,
  );
}

// Aracın bu aralıkta çakışması var mı: onaylı rezervasyon ya da süresi dolmamış BAŞKA bir tutma.
// Aralıklar yarı açıktır: biri tam diğerinin bittiği anda başlayabilir. `ignoreHoldId`, istemcinin
// kendi tutmasıdır (kendi tutması onu engellemez).
export async function hasConflict(
  db: ConflictDb,
  request: Pick<ValidReservationRequest, 'vehicleId' | 'startAt' | 'endAt'>,
  ignoreHoldId: string | null,
  now: Date,
): Promise<boolean> {
  const reservations = await db.reservation.count({
    where: {
      vehicleId: request.vehicleId,
      status: 'CONFIRMED',
      startAt: { lt: request.endAt },
      endAt: { gt: request.startAt },
    },
  });
  if (reservations > 0) return true;
  const holds = await db.hold.count({
    where: {
      vehicleId: request.vehicleId,
      expiresAt: { gt: now },
      startAt: { lt: request.endAt },
      endAt: { gt: request.startAt },
      ...(ignoreHoldId ? { id: { not: ignoreHoldId } } : {}),
    },
  });
  return holds > 0;
}

@Injectable()
export class PricingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async price(input: unknown, user: UserRow | null = null): Promise<PriceBreakdown> {
    const request = parseReservationRequest(input);
    const account = request.usePoints ? requirePointsAccount(user, request.currency) : null;
    await this.assertBranchesExist(request);
    let breakdown = await this.calculate(this.prisma, request, new Date(), user?.id ?? null);
    if (account) {
      const ledger = await loadPointsLedger(this.prisma, account.id, new Date());
      breakdown = withPoints(breakdown, ledger.balance);
    }
    if (await hasConflict(this.prisma, request, request.holdId, new Date())) {
      throw vehicleUnavailable();
    }
    return breakdown;
  }

  async assertBranchesExist(
    request: Pick<ValidReservationRequest, 'pickupBranchId' | 'returnBranchId'>,
  ): Promise<void> {
    const found = await this.prisma.branch.findMany({
      where: { id: { in: [request.pickupBranchId, request.returnBranchId] } },
      select: { id: true },
    });
    const known = new Set(found.map((branch) => branch.id));
    const errors: Record<string, string> = {};
    if (!known.has(request.pickupBranchId)) errors.pickupBranchId = 'UNKNOWN_REFERENCE';
    if (!known.has(request.returnBranchId)) errors.returnBranchId = 'UNKNOWN_REFERENCE';
    if (Object.keys(errors).length > 0) {
      throw validationFailed(errors, 'Branch reference not found');
    }
  }

  // Fiyatı hesaplar. Müsaitliğe bakmaz (çağıran bakar): rezervasyon, aracı kilitledikten sonra
  // bunu aynı işlem içinde çağırır.
  async calculate(
    db: PricingDb,
    request: ValidReservationRequest,
    now: Date = new Date(),
    userId: string | null = null,
  ): Promise<PriceBreakdown> {
    const { currency } = request;
    const days = rentalDays(request.startAt, request.endAt);

    const vehicle = await db.vehicle.findUnique({
      where: { id: request.vehicleId },
      include: { vehicleModel: true },
    });
    if (!vehicle || !vehicle.active || vehicle.branchId !== request.pickupBranchId) {
      throw validationFailed(
        { vehicleId: 'UNKNOWN_REFERENCE' },
        'Vehicle not found at the pickup branch',
      );
    }

    const slugs = request.extras.map((selection) => selection.slug);
    const extras = slugs.length
      ? await db.extra.findMany({ where: { slug: { in: slugs } } })
      : [];
    const extraBySlug = new Map(extras.map((extra) => [extra.slug, extra]));
    if (slugs.some((slug) => !extraBySlug.has(slug))) {
      throw validationFailed({ extras: 'UNKNOWN_REFERENCE' }, 'Extra service not found');
    }

    const rate = await this.getRate(db, currency);
    const money = (amount: number): Money => ({ amount, currency });

    const model = vehicle.vehicleModel;
    const vehicleUnit = convertMinor(model.dailyPrice, rate, currency);
    const lines: PriceLine[] = [
      {
        type: 'VEHICLE',
        slug: model.slug,
        label: { tr: `${model.brand} ${model.model}`, en: `${model.brand} ${model.model}` },
        quantity: days,
        unitPrice: money(vehicleUnit),
        total: money(vehicleUnit * days),
      },
    ];

    for (const selection of request.extras) {
      const extra = extraBySlug.get(selection.slug)!;
      const unit = convertMinor(extra.price, rate, currency);
      // Günlük ek hizmette adet × gün, sabit ek hizmette adet (openapi PriceLine.quantity).
      const quantity = extra.pricing === 'PER_DAY' ? selection.quantity * days : selection.quantity;
      lines.push({
        type: 'EXTRA',
        slug: extra.slug,
        label: { tr: extra.nameTr, en: extra.nameEn },
        quantity,
        unitPrice: money(unit),
        total: money(unit * quantity),
      });
    }

    // A campaign code takes a percentage off the car and the extras together (SPEC §2.3). Rounded down to a
    // whole kuruş or cent, so it is never more than the percentage says. A code that does not exist, is
    // switched off, outside its dates, used up or already used by this person is simply not applied; the answer says
    // so (`promo.applied`) and never says which of these it was, so a visitor cannot tell the codes apart by guessing.
    const subtotal = lines.reduce((sum, line) => sum + line.total.amount, 0);
    let promo: PriceBreakdown['promo'] = null;
    if (request.promoCode) {
      const found = await db.promoCode.findUnique({ where: { code: request.promoCode } });
      const usable =
        found && isPromoUsable(found, now) && (await promoBlock(db, found, userId)) === null ? found : null;
      promo = { code: request.promoCode, applied: usable !== null, percent: usable?.percent ?? null };
      const discount = usable ? Math.floor((subtotal * usable.percent) / 100) : 0;
      if (usable && discount > 0) {
        lines.push({
          type: 'DISCOUNT',
          slug: usable.code,
          label: {
            tr: `Kampanya kodu ${usable.code} (%${usable.percent})`,
            en: `Campaign code ${usable.code} (${usable.percent}% off)`,
          },
          quantity: 1,
          unitPrice: money(-discount),
          total: money(-discount),
        });
      }
    }

    const total = lines.reduce((sum, line) => sum + line.total.amount, 0);
    return {
      currency,
      exchangeRate: rate,
      days,
      lines,
      total: money(total),
      promo,
      pointsUsed: 0,
      payable: money(total),
    };
  }

  private async getRate(db: PricingDb, currency: CurrencyCode): Promise<number> {
    if (currency === 'TRY') return 1;
    const row = await db.exchangeRate.findUnique({ where: { currency } });
    return row ? Number(row.ratePerTry) : FALLBACK_RATES[currency];
  }
}