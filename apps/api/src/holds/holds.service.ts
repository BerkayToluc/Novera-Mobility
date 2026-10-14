import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// POST /holds: "Kirala"da aracı 15 dakika tutar (BACKLOG Y48, openapi.yaml /holds).
export const HOLD_MINUTES = 15;
// Aynı istemcinin aynı anda tutabileceği araç sayısı (biri tüm araçları kilitlemesin).
export const MAX_ACTIVE_HOLDS_PER_CLIENT = 5;
// Süresi dolmuş tutmalar bu kadar süre sonra silinir (DELETE ucu sözleşmede yok).
const STALE_HOLD_AGE_MS = 60 * 60 * 1000;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateHoldInput {
  vehicleId?: unknown;
  pickupBranchId?: unknown;
  returnBranchId?: unknown;
  startAt?: unknown;
  endAt?: unknown;
}

export interface HoldResponse {
  id: string;
  vehicleId: string;
  expiresAt: string;
}

interface ValidHoldInput {
  vehicleId: string;
  pickupBranchId: string;
  returnBranchId: string;
  startAt: Date;
  endAt: Date;
}

function validationFailed(
  fieldErrors: Record<string, string>,
  message: string,
): HttpException {
  return new HttpException(
    { code: 'VALIDATION_FAILED', message, fieldErrors },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function isThirtyMinuteSlot(date: Date): boolean {
  const minutes = date.getUTCMinutes();
  return (
    (minutes === 0 || minutes === 30) &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

@Injectable()
export class HoldsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateHoldInput,
    clientKey: string,
  ): Promise<HoldResponse> {
    const valid = this.validate(input);

    // Bayiler var mı? (işlem dışında, kilit tutmadan)
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: [valid.pickupBranchId, valid.returnBranchId] } },
      select: { id: true },
    });
    const known = new Set(branches.map((branch) => branch.id));
    const referenceErrors: Record<string, string> = {};
    if (!known.has(valid.pickupBranchId)) {
      referenceErrors.pickupBranchId = 'UNKNOWN_REFERENCE';
    }
    if (!known.has(valid.returnBranchId)) {
      referenceErrors.returnBranchId = 'UNKNOWN_REFERENCE';
    }
    if (Object.keys(referenceErrors).length > 0) {
      throw validationFailed(referenceErrors, 'Branch reference not found');
    }

    await this.prisma.hold.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - STALE_HOLD_AGE_MS) } },
    });

    return this.prisma.$transaction(
      async (tx) => {
        // Aracın satırını kilitle. Aynı araç için gelen diğer istekler, bu işlem bitene
        // kadar burada bekler; sonra çakışmayı görüp reddedilir. Kilit olmadan 8 eşzamanlı
        // istekten 8'i de başarılı olur (çifte tutma).
        const locked = await tx.$queryRaw<
          Array<{ id: string; branchId: string; active: boolean }>
        >`SELECT "id", "branchId", "active" FROM "Vehicle" WHERE "id" = ${valid.vehicleId} FOR UPDATE`;
        const vehicle = locked[0];
        if (
          !vehicle ||
          !vehicle.active ||
          vehicle.branchId !== valid.pickupBranchId
        ) {
          throw validationFailed(
            { vehicleId: 'UNKNOWN_REFERENCE' },
            'Vehicle not found at the pickup branch',
          );
        }

        const now = new Date();

        // Aynı istemci aynı aracı aynı aralık için tekrar isterse (sayfa yenileme, geri tuşu)
        // yeni tutma açmak yerine mevcut olanı döndür. Süre uzatılmaz.
        const own = await tx.hold.findFirst({
          where: {
            vehicleId: valid.vehicleId,
            clientKey,
            startAt: valid.startAt,
            endAt: valid.endAt,
            expiresAt: { gt: now },
          },
        });
        if (own) return this.toResponse(own);

        const activeHolds = await tx.hold.count({
          where: { clientKey, expiresAt: { gt: now } },
        });
        if (activeHolds >= MAX_ACTIVE_HOLDS_PER_CLIENT) {
          throw new HttpException(
            {
              code: 'RATE_LIMITED',
              message: 'Too many active vehicle holds',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // Çakışma: onaylı rezervasyon ya da süresi dolmamış başka bir tutma.
        // Aralıklar yarı açıktır: biri tam diğerinin bittiği anda başlayabilir.
        const reservations = await tx.reservation.count({
          where: {
            vehicleId: valid.vehicleId,
            status: 'CONFIRMED',
            startAt: { lt: valid.endAt },
            endAt: { gt: valid.startAt },
          },
        });
        const holds = await tx.hold.count({
          where: {
            vehicleId: valid.vehicleId,
            expiresAt: { gt: now },
            startAt: { lt: valid.endAt },
            endAt: { gt: valid.startAt },
          },
        });
        if (reservations + holds > 0) {
          throw new HttpException(
            {
              code: 'VEHICLE_UNAVAILABLE',
              message: 'The vehicle is not available for the requested period',
            },
            HttpStatus.CONFLICT,
          );
        }

        const created = await tx.hold.create({
          data: {
            vehicleId: valid.vehicleId,
            pickupBranchId: valid.pickupBranchId,
            returnBranchId: valid.returnBranchId,
            startAt: valid.startAt,
            endAt: valid.endAt,
            expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60 * 1000),
            clientKey,
          },
        });
        return this.toResponse(created);
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  private toResponse(hold: {
    id: string;
    vehicleId: string;
    expiresAt: Date;
  }): HoldResponse {
    return {
      id: hold.id,
      vehicleId: hold.vehicleId,
      expiresAt: hold.expiresAt.toISOString(),
    };
  }

  private validate(input: CreateHoldInput): ValidHoldInput {
    const fieldErrors: Record<string, string> = {};

    const uuidField = (
      name: 'vehicleId' | 'pickupBranchId' | 'returnBranchId',
    ): string => {
      const value = input[name];
      if (value === undefined || value === null || value === '') {
        fieldErrors[name] = 'REQUIRED';
        return '';
      }
      if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
        fieldErrors[name] = 'INVALID_FORMAT';
        return '';
      }
      return value;
    };

    const dateField = (name: 'startAt' | 'endAt'): Date | null => {
      const value = input[name];
      if (value === undefined || value === null || value === '') {
        fieldErrors[name] = 'REQUIRED';
        return null;
      }
      const parsed = typeof value === 'string' ? new Date(value) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) {
        fieldErrors[name] = 'INVALID_FORMAT';
        return null;
      }
      if (!isThirtyMinuteSlot(parsed)) {
        fieldErrors[name] = 'NOT_IN_SLOT';
        return null;
      }
      return parsed;
    };

    const vehicleId = uuidField('vehicleId');
    const pickupBranchId = uuidField('pickupBranchId');
    const returnBranchId = uuidField('returnBranchId');
    const startAt = dateField('startAt');
    const endAt = dateField('endAt');

    if (startAt && endAt && endAt.getTime() <= startAt.getTime()) {
      fieldErrors.endAt = 'INVALID_DATE_RANGE';
    }

    if (Object.keys(fieldErrors).length > 0 || !startAt || !endAt) {
      throw validationFailed(fieldErrors, 'Hold request validation failed');
    }

    return { vehicleId, pickupBranchId, returnBranchId, startAt, endAt };
  }
}
