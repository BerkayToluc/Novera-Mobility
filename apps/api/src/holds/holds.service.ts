import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HOUR_MS } from '../common/time.js';
import { hasConflict } from '../common/availability.js';
import { isUuid } from '../common/uuid.js';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { holdSchema } from './holds.schemas.js';

// POST /holds: "Kirala"da aracı 15 dakika tutar (BACKLOG Y48, openapi.yaml /holds).
export const HOLD_MINUTES = 15;
// Aynı istemcinin aynı anda tutabileceği araç sayısı (biri tüm araçları kilitlemesin).
export const MAX_ACTIVE_HOLDS_PER_CLIENT = 5;
// Süresi dolmuş tutmalar bu kadar süre sonra silinir (kullanıcı vazgeçmezse DELETE çağrılmaz).
const STALE_HOLD_AGE_MS = HOUR_MS;

export interface HoldResponse {
  id: string;
  vehicleId: string;
  expiresAt: string;
}

@Injectable()
export class HoldsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: unknown,
    clientKey: string,
  ): Promise<HoldResponse> {
    const valid = parseInput(holdSchema(new Date()), input, 'Hold request validation failed');

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

        // Çakışma: onaylı rezervasyon ya da süresi dolmamış başka bir tutma (common/availability.ts).
        if (await hasConflict(tx, valid, null, now)) {
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

  // DELETE /holds/{id}: the visitor changed the search or gave up, so the car is free again at once.
  // Only the client that made the hold can release it (the same key the limit uses). A missing, expired
  // or someone else's hold is a quiet no-op, so the call can be repeated and never tells who holds what.
  async release(id: string, clientKey: string): Promise<void> {
    if (!isUuid(id)) return;
    await this.prisma.hold.deleteMany({ where: { id, clientKey } });
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
}
