import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Currency } from '../generated/prisma/client.js';
import { parseInput } from '../common/zod-validation.js';
import { currencyQuerySchema, vehicleSearchSchema } from './catalog.schemas.js';


const FALLBACK_RATES: Record<Currency, number> = {
  TRY: 1,
  EUR: 0.02,
  USD: 0.023,
};

export interface SearchVehiclesQuery {
  pickupBranchId?: string;
  returnBranchId?: string;
  startAt?: string;
  endAt?: string;
  currency?: string;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // `?currency=` left out or empty means TRY; anything outside the list is 422 (ADR-26).
  parseCurrency(raw?: string): Currency {
    return parseInput(currencyQuerySchema, { currency: raw }, 'Invalid currency parameter').currency ?? 'TRY';
  }

  private async getRate(currency: Currency): Promise<number> {
    if (currency === 'TRY') return 1;
    const row = await this.prisma.exchangeRate.findUnique({
      where: { currency },
    });
    return row ? Number(row.ratePerTry) : FALLBACK_RATES[currency];
  }

  private toMoney(amountInTryKurus: number, rate: number, currency: Currency) {
    return {
      amount:
        currency === 'TRY'
          ? amountInTryKurus
          : Math.round(amountInTryKurus * rate),
      currency,
    };
  }

  async getBranches() {
    const branches = await this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: {
        vehicles: {
          where: { active: true },
          select: {
            vehicleModel: {
              select: { slug: true, brand: true, model: true },
            },
          },
        },
      },
    });

    return branches.map((b) => {
      const uniqueModels = new Map<
        string,
        { slug: string; brand: string; model: string }
      >();
      for (const v of b.vehicles) {
        uniqueModels.set(v.vehicleModel.slug, v.vehicleModel);
      }

      return {
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        phone: b.phone,
        email: b.email,
        openingHours: b.openingHours as {
          weekdays: string;
          saturday: string;
          sunday: string;
        },
        vehicleModels: Array.from(uniqueModels.values()),
      };
    });
  }

  async getVehicleModels(currencyParam?: string) {
    const currency = this.parseCurrency(currencyParam);
    const rate = await this.getRate(currency);

    const models = await this.prisma.vehicleModel.findMany({
      orderBy: { dailyPrice: 'asc' },
      include: {
        class: true,
        vehicles: {
          where: { active: true },
          select: {
            branch: {
              select: { id: true, name: true, city: true },
            },
          },
        },
      },
    });

    return models.map((m) => {
      const uniqueBranches = new Map<
        string,
        { id: string; name: string; city: true }
      >();
      for (const v of m.vehicles) {
        uniqueBranches.set(v.branch.id, v.branch as any);
      }

      return {
        slug: m.slug,
        brand: m.brand,
        model: m.model,
        class: {
          slug: m.class.slug,
          name: { tr: m.class.nameTr, en: m.class.nameEn },
        },
        seats: m.seats,
        bags: m.bags,
        transmission: m.transmission,
        fuelType: m.fuelType,
        consumption: {
          value: m.consumption,
          unit: m.consumptionUnit,
        },
        description: m.description as { tr: string; en: string },
        imageUrl: m.imageUrl,
        fromDailyPrice: this.toMoney(m.dailyPrice, rate, currency),
        branches: Array.from(uniqueBranches.values()),
      };
    });
  }

  async getAvailableVehicles(query: SearchVehiclesQuery) {
    const search = parseInput(vehicleSearchSchema(new Date()), query, 'Vehicle search query validation failed');
    const fieldErrors: Record<string, string> = {};
    const { pickupBranchId, returnBranchId, startAt, endAt } = search;
    const currency = search.currency ?? 'TRY';

    // Bayilerin veritabanında var olduğunu kontrol et
    const [pickupBranch, returnBranch] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: pickupBranchId },
        select: { id: true, name: true, city: true },
      }),
      this.prisma.branch.findUnique({
        where: { id: returnBranchId },
        select: { id: true },
      }),
    ]);

    if (!pickupBranch) fieldErrors.pickupBranchId = 'UNKNOWN_REFERENCE';
    if (!returnBranch) fieldErrors.returnBranchId = 'UNKNOWN_REFERENCE';

    if (Object.keys(fieldErrors).length > 0) {
      throw new HttpException(
        {
          code: 'VALIDATION_FAILED',
          message: 'Branch reference not found',
          fieldErrors,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const now = new Date();
    const rate = await this.getRate(currency);

    // Gün sayısı: ceil((endAt - startAt) / 24 saat), en az 1
    const diffMs = endAt.getTime() - startAt.getTime();
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    // Alış bayisinde bulunan ve belirtilen tarih aralığında çakışan rezervasyonu / aktif hold'u olmayan araçlar
    const availableVehicles = await this.prisma.vehicle.findMany({
      where: {
        branchId: pickupBranchId,
        active: true,
        reservations: {
          none: {
            status: 'CONFIRMED',
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        },
        holds: {
          none: {
            expiresAt: { gt: now },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        },
      },
      include: {
        vehicleModel: {
          include: {
            class: true,
          },
        },
      },
      orderBy: {
        vehicleModel: {
          dailyPrice: 'asc',
        },
      },
    });

    // Model başına tek bir sonuç döndür (VehicleOffer)
    const offerByModelSlug = new Map<string, any>();

    for (const v of availableVehicles) {
      const m = v.vehicleModel;
      if (offerByModelSlug.has(m.slug)) continue;

      const dailyMoney = this.toMoney(m.dailyPrice, rate, currency);
      const totalMoney = {
        amount: dailyMoney.amount * days,
        currency,
      };

      offerByModelSlug.set(m.slug, {
        vehicleId: v.id,
        year: v.year,
        model: {
          slug: m.slug,
          brand: m.brand,
          model: m.model,
          class: {
            slug: m.class.slug,
            name: { tr: m.class.nameTr, en: m.class.nameEn },
          },
          seats: m.seats,
          bags: m.bags,
          transmission: m.transmission,
          fuelType: m.fuelType,
          consumption: {
            value: m.consumption,
            unit: m.consumptionUnit,
          },
          description: m.description as { tr: string; en: string },
          imageUrl: m.imageUrl,
        },
        branch: pickupBranch!,
        days,
        dailyPrice: dailyMoney,
        totalPrice: totalMoney,
      });
    }

    return Array.from(offerByModelSlug.values());
  }

  async getExtras(currencyParam?: string) {
    const currency = this.parseCurrency(currencyParam);
    const rate = await this.getRate(currency);

    const extras = await this.prisma.extra.findMany({
      orderBy: { price: 'asc' },
    });

    return extras.map((e) => ({
      slug: e.slug,
      name: { tr: e.nameTr, en: e.nameEn },
      price: this.toMoney(e.price, rate, currency),
      pricing: e.pricing,
    }));
  }

  async getRates() {
    const rates = await this.prisma.exchangeRate.findMany({
      orderBy: { currency: 'asc' },
    });

    return rates.map((r) => ({
      currency: r.currency,
      ratePerTry: Number(r.ratePerTry),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
}