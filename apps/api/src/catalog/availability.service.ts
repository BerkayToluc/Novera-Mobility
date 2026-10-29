import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { blockingHold, blockingReservation } from '../common/availability.js';
import { getRate, toMoney } from '../common/money.js';
import { rentalDays } from '../common/time.js';
import { parseInput } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { vehicleSearchSchema } from './catalog.schemas.js';
import { modelView } from './model-view.js';

export interface SearchVehiclesQuery {
  pickupBranchId?: string;
  returnBranchId?: string;
  startAt?: string;
  endAt?: string;
  currency?: string;
}

// GET /vehicles: which models can be taken at a branch for a period, one offer per model (openapi `VehicleOffer`).
@Injectable()
export class AvailabilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAvailableVehicles(query: SearchVehiclesQuery) {
    const search = parseInput(vehicleSearchSchema(new Date()), query, 'Vehicle search query validation failed');
    const { pickupBranchId, returnBranchId, startAt, endAt } = search;
    const currency = search.currency ?? 'TRY';

    // Both branches have to exist.
    const [pickupBranch, returnBranch] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: pickupBranchId, closedAt: null }, select: { id: true, name: true, city: true } }),
      this.prisma.branch.findFirst({ where: { id: returnBranchId, closedAt: null }, select: { id: true } }),
    ]);
    const fieldErrors: Record<string, string> = {};
    if (!pickupBranch) fieldErrors.pickupBranchId = 'UNKNOWN_REFERENCE';
    if (!returnBranch) fieldErrors.returnBranchId = 'UNKNOWN_REFERENCE';
    if (!pickupBranch || Object.keys(fieldErrors).length > 0) {
      throw new HttpException(
        { code: 'VALIDATION_FAILED', message: 'Branch reference not found', fieldErrors },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const now = new Date();
    const rate = await getRate(this.prisma, currency);
    const days = rentalDays(startAt, endAt);

    // Vehicles at the pickup branch with no confirmed reservation and no live hold in the period (common/availability.ts).
    const period = { startAt, endAt };
    const availableVehicles = await this.prisma.vehicle.findMany({
      where: {
        branchId: pickupBranchId,
        active: true,
        // A retired model switches its cars off; this also keeps one out that was switched on again by hand (V2-29).
        vehicleModel: { retiredAt: null },
        reservations: { none: blockingReservation(period) },
        holds: { none: blockingHold(period, now) },
      },
      include: { vehicleModel: { include: { class: true } } },
      orderBy: { vehicleModel: { dailyPrice: 'asc' } },
    });

    // One offer per model: the first vehicle of it.
    const offerOf = (vehicle: (typeof availableVehicles)[number]) => {
      const model = vehicle.vehicleModel;
      const dailyPrice = toMoney(model.dailyPrice, rate, currency);
      return {
        vehicleId: vehicle.id,
        year: vehicle.year,
        model: modelView(model),
        branch: pickupBranch,
        days,
        dailyPrice,
        totalPrice: { amount: dailyPrice.amount * days, currency },
      };
    };
    const offers = new Map<string, ReturnType<typeof offerOf>>();
    for (const vehicle of availableVehicles) {
      if (!offers.has(vehicle.vehicleModel.slug)) offers.set(vehicle.vehicleModel.slug, offerOf(vehicle));
    }
    return Array.from(offers.values());
  }
}
