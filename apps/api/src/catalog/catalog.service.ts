import { Inject, Injectable } from '@nestjs/common';
import { getRate, toMoney } from '../common/money.js';
import { parseInput } from '../common/zod-validation.js';
import type { Currency } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { currencyQuerySchema } from './catalog.schemas.js';
import { modelView } from './model-view.js';

// The read-only catalog: branches, vehicle models, extras and the exchange rates. The search for available
// vehicles is in availability.service.ts.
@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // `?currency=` left out or empty means TRY; anything outside the list is 422 (ADR-26).
  parseCurrency(raw?: string): Currency {
    return parseInput(currencyQuerySchema, { currency: raw }, 'Invalid currency parameter').currency ?? 'TRY';
  }

  async getBranches() {
    const branches = await this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: {
        vehicles: {
          where: { active: true },
          select: { vehicleModel: { select: { slug: true, brand: true, model: true } } },
        },
      },
    });

    return branches.map((b) => {
      const uniqueModels = new Map<string, { slug: string; brand: string; model: string }>();
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
        openingHours: b.openingHours as { weekdays: string; saturday: string; sunday: string },
        vehicleModels: Array.from(uniqueModels.values()),
      };
    });
  }

  async getVehicleModels(currencyParam?: string) {
    const currency = this.parseCurrency(currencyParam);
    const rate = await getRate(this.prisma, currency);

    const models = await this.prisma.vehicleModel.findMany({
      orderBy: { dailyPrice: 'asc' },
      include: {
        class: true,
        vehicles: {
          where: { active: true },
          select: { branch: { select: { id: true, name: true, city: true } } },
        },
      },
    });

    return models.map((m) => {
      const uniqueBranches = new Map<string, { id: string; name: string; city: string }>();
      for (const v of m.vehicles) {
        uniqueBranches.set(v.branch.id, v.branch);
      }

      return {
        ...modelView(m),
        fromDailyPrice: toMoney(m.dailyPrice, rate, currency),
        branches: Array.from(uniqueBranches.values()),
      };
    });
  }

  async getExtras(currencyParam?: string) {
    const currency = this.parseCurrency(currencyParam);
    const rate = await getRate(this.prisma, currency);

    const extras = await this.prisma.extra.findMany({ orderBy: { price: 'asc' } });

    return extras.map((e) => ({
      slug: e.slug,
      name: { tr: e.nameTr, en: e.nameEn },
      price: toMoney(e.price, rate, currency),
      pricing: e.pricing,
    }));
  }

  async getRates() {
    const rates = await this.prisma.exchangeRate.findMany({ orderBy: { currency: 'asc' } });

    return rates.map((r) => ({
      currency: r.currency,
      ratePerTry: Number(r.ratePerTry),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
}
