import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import { validationFailed } from '../forms/form-input.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PricingService,
  hasConflict,
  requirePointsAccount,
  vehicleUnavailable,
  withPoints,
  type ConflictDb,
  type PricingDb,
} from './pricing.service.js';
import { loadPointsLedger, type LedgerDb } from './points-balance.js';
import { POINTS_RULES, pointsForTotal } from './points.rules.js';
import { parseReservationRequest, type ValidReservationRequest } from './reservation-input.js';
import {
  RESERVATION_INCLUDE,
  toReservationView,
  type ReservationRow,
} from './reservation-view.js';

const NUMBER_ATTEMPTS = 5;
// One account cannot hold more than this many upcoming or running bookings at once (G, 24 Ekim: 3); no
// payment is taken, so without a cap one account could lock the whole fleet for months (QUALITY G-02).
export const MAX_ACTIVE_RESERVATIONS = 3;

function reservationLimitReached(): HttpException {
  return new HttpException(
    {
      code: 'RESERVATION_LIMIT',
      message: `An account can have at most ${MAX_ACTIVE_RESERVATIONS} upcoming reservations`,
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function reservationNotFound(): HttpException {
  return new HttpException({ code: 'NOT_FOUND', message: 'Reservation not found' }, HttpStatus.NOT_FOUND);
}

function notCancellable(): HttpException {
  return new HttpException(
    { code: 'RESERVATION_NOT_CANCELLABLE', message: 'The rental has already started, it can no longer be cancelled' },
    HttpStatus.CONFLICT,
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

// Numara yılı Türkiye saatine göre belirlenir (ADR-16).
function istanbulYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(date),
  );
}

@Injectable()
export class ReservationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PricingService) private readonly pricing: PricingService,
  ) {}

  // POST /reservations: her şey TEK işlemde olur (araç kilidi, müsaitlik, fiyat, kayıt, puan, tutmanın silinmesi).
  // `clientKey` is the caller's address key (see clientKeyOf): a hold only counts as theirs when it was made from it.
  async create(user: UserRow, input: unknown, clientKey: string | null = null) {
    const request = parseReservationRequest(input);
    await this.pricing.assertBranchesExist(request);

    // Numara çakışması (P2002) işlemi bozar; bu yüzden yeniden deneme İŞLEMİN DIŞINDADIR.
    for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt += 1) {
      try {
        return await this.createOnce(user, request, clientKey);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new Error('Could not allocate a reservation number');
  }

  private async createOnce(user: UserRow, request: ValidReservationRequest, clientKey: string | null) {
    return this.prisma.$transaction(async (tx) => {
      // Aracın satırını kilitle: aynı araç için gelen diğer istekler bu işlem bitene kadar bekler,
      // sonra çakışmayı görüp 409 alır (kilit yoksa iki kişi aynı aracı alabilir).
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${request.vehicleId} FOR UPDATE`;
      // The account is locked too (always after the vehicle, so locks never cross): two bookings made at the
      // same moment can neither slip past the cap together nor spend the same points twice.
      if (request.usePoints) requirePointsAccount(user, request.currency);
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;

      const now = new Date();

      const active = await tx.reservation.count({
        where: { userId: user.id, status: 'CONFIRMED', endAt: { gt: now } },
      });
      if (active >= MAX_ACTIVE_RESERVATIONS) throw reservationLimitReached();

      // Tutma: aynı araç/bayi/saatler için geçerliyse ve aynı istemci anahtarıyla açılmışsa istemcinin kendi
      // tutmasıdır (engel olmaz, işlem sonunda silinir). Başkasının tutması, süresi dolmuş ya da uymayan tutma
      // yokmuş gibi sayılır; müsaitlik aşağıda yine kontrol edilir (openapi, QUALITY G-16).
      let ownHoldId: string | null = null;
      if (request.holdId) {
        const hold = await tx.hold.findUnique({ where: { id: request.holdId } });
        if (
          hold &&
          clientKey !== null &&
          hold.clientKey === clientKey &&
          hold.vehicleId === request.vehicleId &&
          hold.pickupBranchId === request.pickupBranchId &&
          hold.returnBranchId === request.returnBranchId &&
          hold.startAt.getTime() === request.startAt.getTime() &&
          hold.endAt.getTime() === request.endAt.getTime()
        ) {
          ownHoldId = hold.id;
        }
      }

      if (await hasConflict(tx as unknown as ConflictDb, request, ownHoldId, now)) {
        throw vehicleUnavailable();
      }

      // Toplamı sunucu hesaplar; istemciden fiyat alınmaz.
      let price = await this.pricing.calculate(tx as unknown as PricingDb, request, now);
      // The price page shows an unknown code as "not valid" and charges the plain price; a booking must not
      // quietly do that, because the visitor was told a discount would be taken off.
      if (price.promo && !price.promo.applied) {
        throw validationFailed({ promoCode: 'UNKNOWN_CODE' }, 'The campaign code is not valid');
      }
      if (request.usePoints) {
        const ledger = await loadPointsLedger(tx as unknown as LedgerDb, user.id, now);
        price = withPoints(price, ledger.balance);
      }

      const slugs = request.extras.map((selection) => selection.slug);
      const extraRows = slugs.length
        ? await tx.extra.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } })
        : [];
      const extraId = new Map(extraRows.map((row) => [row.slug, row.id]));

      const prefix = `NVR-${istanbulYear(now)}-`;
      const last = await tx.reservation.findFirst({
        where: { number: { startsWith: prefix } },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const lastSerial = last ? Number(last.number.slice(prefix.length)) : 0;
      const number = `${prefix}${String((Number.isFinite(lastSerial) ? lastSerial : 0) + 1).padStart(5, '0')}`;

      // The discount line, when there is one, is last, so the extras still line up with `request.extras`.
      const [vehicleLine, ...restLines] = price.lines;
      const extraLines = restLines.filter((line) => line.type === 'EXTRA');
      const discountLine = restLines.find((line) => line.type === 'DISCOUNT');
      const created = await tx.reservation.create({
        data: {
          number,
          status: 'CONFIRMED',
          startAt: request.startAt,
          endAt: request.endAt,
          days: price.days,
          currency: price.currency,
          exchangeRate: price.exchangeRate,
          vehicleDailyPrice: vehicleLine!.unitPrice.amount,
          totalPrice: price.total.amount,
          pointsUsed: price.pointsUsed,
          promoCode: discountLine ? price.promo!.code : null,
          promoPercent: discountLine ? price.promo!.percent : null,
          discountAmount: discountLine ? -discountLine.total.amount : 0,
          userId: user.id,
          vehicleId: request.vehicleId,
          pickupBranchId: request.pickupBranchId,
          returnBranchId: request.returnBranchId,
          extras: {
            create: request.extras.map((selection, index) => ({
              quantity: selection.quantity,
              unitPrice: extraLines[index]!.unitPrice.amount,
              totalPrice: extraLines[index]!.total.amount,
              extraId: extraId.get(selection.slug)!,
            })),
          },
        },
        select: { id: true },
      });

      // Puan aynı işlemde yazılır; bakiyeye KİRALAMA BİTİNCE geçer (GET /me/points tarihe bakar).
      // Points are earned on the money actually paid (the part paid with points earns nothing).
      const points = pointsForTotal(price.payable.amount, price.currency, price.exchangeRate);
      if (points > 0) {
        await tx.pointTransaction.create({
          data: { userId: user.id, reservationId: created.id, points },
        });
      }

      if (ownHoldId) await tx.hold.delete({ where: { id: ownHoldId } });

      const row = await tx.reservation.findUniqueOrThrow({
        where: { id: created.id },
        include: RESERVATION_INCLUDE,
      });
      return toReservationView(row as unknown as ReservationRow);
    });
  }

  // GET /me/reservations: yeniden eskiye (kiralama başlangıcına göre).
  async listMine(userId: string) {
    const rows = await this.prisma.reservation.findMany({
      where: { userId },
      orderBy: { startAt: 'desc' },
      include: RESERVATION_INCLUDE,
    });
    return rows.map((row) => toReservationView(row as unknown as ReservationRow));
  }

  // GET /me/reservations/{id}: one reservation of the signed-in user (the confirmation page reads it by
  // the id from the list or the create answer). Someone else's or an unknown id is 404, like cancel.
  async getMine(userId: string, id: string) {
    const row = await this.prisma.reservation.findFirst({
      where: { id, userId },
      include: RESERVATION_INCLUDE,
    });
    if (!row) throw reservationNotFound();
    return toReservationView(row as unknown as ReservationRow);
  }

  // POST /me/reservations/{id}/cancel: yalnızca kiralama BAŞLAMADAN iptal edilir (ücretsiz/ücretli ayrımı
  // ödeme gelince; şimdilik para akışı yok). İptal tek bir koşullu güncellemedir, yarış olursa biri kazanır.
  // Zaten iptal edilmişse aynı sonuç döner (tekrar çağrı zararsız). Başkasının ya da olmayan rezervasyon: 404.
  // Araç, iptalle hemen yeniden müsait olur (çakışma yalnız CONFIRMED'a bakar); puan kaydı durur ama
  // GET /me/points iptal edilenleri saymaz.
  async cancel(userId: string, id: string, now: Date = new Date()) {
    const claimed = await this.prisma.reservation.updateMany({
      where: { id, userId, status: 'CONFIRMED', startAt: { gt: now } },
      data: { status: 'CANCELLED' },
    });
    const row = await this.prisma.reservation.findFirst({
      where: { id, userId },
      include: RESERVATION_INCLUDE,
    });
    if (!row) throw reservationNotFound();
    if (claimed.count === 0 && row.status === 'CONFIRMED') throw notCancellable();
    return toReservationView(row as unknown as ReservationRow);
  }

  // GET /me/points: bakiye = bitmiş kiralamaların puanı eksi harcananlar, `pending` = henüz bitmemiş olanların.
  // İptal edilen rezervasyon sayılmaz (harcanan puan iade olur). Geçmişte harcamalar eksi puanla görünür.
  async points(userId: string, now: Date = new Date()) {
    const ledger = await loadPointsLedger(this.prisma, userId, now);
    return { ...ledger, rules: POINTS_RULES };
  }
}