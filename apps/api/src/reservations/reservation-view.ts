import type { PriceBreakdown, PriceLine } from './pricing.service.js';
import { pointsWorthMinor } from './points.rules.js';
import type { CurrencyCode } from './reservation-input.js';

// Veritabanındaki rezervasyon satırından openapi.yaml `Reservation` cevabını üretir.
// Fiyat, oluşturma anında SAKLANAN değerlerden kurulur (kur ve fiyatlar sonradan değişse de aynı kalır).
export type ReservationRow = {
  id: string;
  number: string;
  status: 'CONFIRMED' | 'CANCELLED';
  startAt: Date;
  endAt: Date;
  days: number;
  currency: CurrencyCode;
  exchangeRate: unknown; // Prisma Decimal
  vehicleDailyPrice: number;
  totalPrice: number;
  pointsUsed: number;
  promoCode: string | null;
  promoPercent: number | null;
  discountAmount: number;
  createdAt: Date;
  vehicle: {
    id: string;
    year: number;
    vehicleModel: {
      slug: string;
      brand: string;
      model: string;
      seats: number;
      bags: number;
      transmission: string;
      fuelType: string;
      consumption: number;
      consumptionUnit: string;
      description: unknown;
      imageUrl: string | null;
      class: { slug: string; nameTr: string; nameEn: string };
    };
  };
  pickupBranch: { id: string; name: string; city: string };
  returnBranch: { id: string; name: string; city: string };
  extras: Array<{
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    extra: { slug: string; nameTr: string; nameEn: string; pricing: 'PER_DAY' | 'FIXED' };
  }>;
  pointTransaction: { points: number } | null;
};

export const RESERVATION_INCLUDE = {
  vehicle: { include: { vehicleModel: { include: { class: true } } } },
  pickupBranch: { select: { id: true, name: true, city: true } },
  returnBranch: { select: { id: true, name: true, city: true } },
  extras: { include: { extra: true } },
  pointTransaction: { select: { points: true } },
} as const;

export function toPriceBreakdown(row: ReservationRow): PriceBreakdown {
  const money = (amount: number) => ({ amount, currency: row.currency });
  const model = row.vehicle.vehicleModel;
  const lines: PriceLine[] = [
    {
      type: 'VEHICLE',
      slug: model.slug,
      label: { tr: `${model.brand} ${model.model}`, en: `${model.brand} ${model.model}` },
      quantity: row.days,
      unitPrice: money(row.vehicleDailyPrice),
      total: money(row.vehicleDailyPrice * row.days),
    },
    ...row.extras.map((item): PriceLine => ({
      type: 'EXTRA',
      slug: item.extra.slug,
      label: { tr: item.extra.nameTr, en: item.extra.nameEn },
      quantity: item.extra.pricing === 'PER_DAY' ? item.quantity * row.days : item.quantity,
      unitPrice: money(item.unitPrice),
      total: money(item.totalPrice),
    })),
  ];
  // The code taken off, as it was when the reservation was made (the code may have changed since).
  if (row.promoCode && row.discountAmount > 0) {
    lines.push({
      type: 'DISCOUNT',
      slug: row.promoCode,
      label: {
        tr: `Kampanya kodu ${row.promoCode} (%${row.promoPercent ?? 0})`,
        en: `Campaign code ${row.promoCode} (${row.promoPercent ?? 0}% off)`,
      },
      quantity: 1,
      unitPrice: money(-row.discountAmount),
      total: money(-row.discountAmount),
    });
  }
  return {
    currency: row.currency,
    exchangeRate: Number(row.exchangeRate),
    days: row.days,
    lines,
    total: money(row.totalPrice),
    promo: row.promoCode ? { code: row.promoCode, applied: true, percent: row.promoPercent } : null,
    pointsUsed: row.pointsUsed,
    payable: money(row.totalPrice - pointsWorthMinor(row.pointsUsed)),
  };
}

export function toReservationView(row: ReservationRow) {
  const model = row.vehicle.vehicleModel;
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    vehicle: {
      id: row.vehicle.id,
      year: row.vehicle.year,
      model: {
        slug: model.slug,
        brand: model.brand,
        model: model.model,
        class: { slug: model.class.slug, name: { tr: model.class.nameTr, en: model.class.nameEn } },
        seats: model.seats,
        bags: model.bags,
        transmission: model.transmission,
        fuelType: model.fuelType,
        consumption: { value: model.consumption, unit: model.consumptionUnit },
        description: model.description,
        imageUrl: model.imageUrl,
      },
    },
    pickupBranch: row.pickupBranch,
    returnBranch: row.returnBranch,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    price: toPriceBreakdown(row),
    // İptal edilen rezervasyon puan kazandırmaz.
    pointsEarned: row.status === 'CONFIRMED' ? (row.pointTransaction?.points ?? 0) : 0,
    createdAt: row.createdAt.toISOString(),
  };
}
