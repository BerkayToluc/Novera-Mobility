import type { components } from "./api-types";
import type { BranchDetail, DayHours } from "./branch-detail";
import type { Extra } from "./extra";
import { VAT_PERCENT, type PriceSummary } from "./price-summary";
import type { PointsAccount } from "./points";
import type { Session } from "./session";
import type { Vehicle, VehicleOffer } from "./vehicle";
import type { QuoteRequest } from "./quote-request";
import type { Reservation } from "./reservation";

type Schemas = components["schemas"];

// The API's shapes turned into the ones the pages already use (docs/API-GAPS.md lists the
// differences). Pure functions, kept apart from the calls so they can be tested.

export function reservationFromApi(reservation: Schemas["Reservation"]): Reservation {
  return {
    id: reservation.id,
    number: reservation.number,
    status: reservation.status,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    days: reservation.price.days,
    totalPrice: reservation.price.total,
    vehicle: { brand: reservation.vehicle.model.brand, model: reservation.vehicle.model.model },
    pickupCity: reservation.pickupBranch.city,
    returnCity: reservation.returnBranch.city,
    pickupBranchId: reservation.pickupBranch.id,
    returnBranchId: reservation.returnBranch.id,
    pointsEarned: reservation.pointsEarned,
  };
}

// `rules` (the rule text in both languages) is not used: the page keeps its own, translated with
// the rest of the site, and the rule itself is in lib/points.ts.
export function pointsFromApi(points: Schemas["Points"]): PointsAccount {
  return {
    balance: points.balance,
    pending: points.pending,
    history: points.history.map((entry) => ({
      points: entry.points,
      reservationNumber: entry.reservationNumber ?? null,
      createdAt: entry.createdAt,
    })),
  };
}

export function quoteFromApi(quote: Schemas["QuoteSummary"]): QuoteRequest {
  return {
    id: quote.id,
    reference: quote.number,
    sentAt: quote.createdAt,
    vehicleCount: quote.vehicleCount,
    durationMonths: quote.durationMonths,
    status: quote.status,
  };
}

// `GET /me` as the signed-in session. A corporate account brings its company details; the company
// page shows the rows it has.
export function sessionFromApi(user: Schemas["User"]): Session {
  const base = { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email };
  const saved = {
    preferences: { currency: user.currency, locale: user.locale, theme: user.theme },
    ...(user.notifications ? { notifications: user.notifications } : {}),
  };
  if (user.accountType !== "CORPORATE") return { type: "individual", user: base, ...saved };
  return {
    type: "corporate",
    user: base,
    company: {
      name: user.companyName ?? "",
      ...(user.taxOffice ? { taxOffice: user.taxOffice } : {}),
      ...(user.companyCity ? { city: user.companyCity } : {}),
      ...(user.companyPhone ? { phone: user.companyPhone } : {}),
      ...(user.contactTitle ? { contactTitle: user.contactTitle } : {}),
      ...(user.salesContact ? { salesContact: user.salesContact.email } : {}),
    },
    ...saved,
  };
}

// ---- Catalogue ----

// "08:30-19:00" or "closed" (openapi `OpeningHours`) as the pages hold it.
const parseHours = (value: string): DayHours => {
  if (value === "closed") return null;
  const [open, close] = value.split("-");
  return open && close ? { open, close } : null;
};

export function branchDetailFromApi(branch: Schemas["Branch"]): BranchDetail {
  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    phone: branch.phone,
    email: branch.email,
    openingHours: {
      weekdays: parseHours(branch.openingHours.weekdays),
      saturday: parseHours(branch.openingHours.saturday),
      sunday: parseHours(branch.openingHours.sunday),
    },
  };
}

type ModelBase = Schemas["VehicleModelBase"];

// A car is told apart in the address by its model and its id, "toyota-corolla-hybrid.<uuid>": the model
// for what to show (there is no endpoint for one car), the id for what to hold and book.
export const VEHICLE_SLUG_SEPARATOR = ".";

export function vehicleSlug(modelSlug: string, vehicleId: string): string {
  return `${modelSlug}${VEHICLE_SLUG_SEPARATOR}${vehicleId}`;
}

export function parseVehicleSlug(slug: string): { modelSlug: string; vehicleId: string } | null {
  const at = slug.lastIndexOf(VEHICLE_SLUG_SEPARATOR);
  if (at < 1) return null;
  return { modelSlug: slug.slice(0, at), vehicleId: slug.slice(at + 1) };
}

function vehicleFromModel(model: ModelBase, base: Pick<Vehicle, "id" | "slug" | "branchId" | "dailyPrice">): Vehicle {
  return {
    ...base,
    modelSlug: model.slug,
    brand: model.brand,
    model: model.model,
    seats: model.seats,
    bags: model.bags,
    transmission: model.transmission,
    fuelType: model.fuelType,
    consumption: model.consumption,
    description: model.description,
    imageUrl: model.imageUrl,
    vehicleClass: { slug: model.class.slug, name: model.class.name },
  };
}

// `GET /vehicle-models` lists each model with its branches; the fleet page wants one car per model
// and branch, priced from the model's lowest daily price.
export function vehiclesFromModels(models: Schemas["VehicleModel"][]): Vehicle[] {
  return models.flatMap((model) =>
    model.branches.map((branch) => {
      const id = `${model.slug}:${branch.id}`;
      return vehicleFromModel(model, { id, slug: id, branchId: branch.id, dailyPrice: model.fromDailyPrice });
    }),
  );
}

export function offerFromApi(offer: Schemas["VehicleOffer"]): VehicleOffer {
  const vehicle = vehicleFromModel(offer.model, {
    id: offer.vehicleId,
    slug: vehicleSlug(offer.model.slug, offer.vehicleId),
    branchId: offer.branch.id,
    dailyPrice: offer.dailyPrice,
  });
  return { ...vehicle, year: offer.year, days: offer.days, totalPrice: offer.totalPrice };
}

// The car of a booking, from its model. The price here is the model's lowest; the booking's own comes
// from `POST /reservations/price`.
export function bookedVehicle(model: Schemas["VehicleModel"], vehicleId: string, branchId: string, slug: string): Vehicle {
  return vehicleFromModel(model, { id: vehicleId, slug, branchId, dailyPrice: model.fromDailyPrice });
}

export const extraFromApi = (extra: Schemas["Extra"]): Extra => ({
  slug: extra.slug,
  name: extra.name,
  price: extra.price,
  pricing: extra.pricing,
});


// ---- Price ----

// The API's lines as the summary shows them: the car, the extras (matched by slug, in the order asked), and
// the campaign code's line, a last one with a negative amount. Everything is the server's (ADR-15), nothing
// is added up here: `total` is already without the discount, `payable` is what is left after the points.
// A code that took nothing off (`promo.applied: false`) has no discount line, so there is no discount.
export function summaryFromApi(breakdown: Schemas["PriceBreakdown"], extras: Extra[]): PriceSummary {
  const { currency } = breakdown;
  const vehicleLine = breakdown.lines.find((line) => line.type === "VEHICLE");
  const discountLine = breakdown.lines.find((line) => line.type === "DISCOUNT");
  const extraLines = breakdown.lines
    .filter((line) => line.type === "EXTRA")
    .flatMap((line) => {
      const extra = extras.find((candidate) => candidate.slug === line.slug);
      return extra ? [{ extra, cost: line.total }] : [];
    });
  const discountAmount = discountLine ? Math.abs(discountLine.total.amount) : 0;
  const { payable, pointsUsed } = breakdown;
  return {
    vehicleTotal: vehicleLine?.total ?? { amount: 0, currency },
    extraLines,
    // The car and the extras together, before the code.
    subtotal: { amount: breakdown.total.amount + discountAmount, currency },
    discount:
      discountLine && breakdown.promo?.applied
        ? { code: breakdown.promo.code, percent: breakdown.promo.percent ?? 0, amount: { amount: discountAmount, currency } }
        : null,
    points:
      pointsUsed > 0 ? { count: pointsUsed, amount: { amount: breakdown.total.amount - payable.amount, currency } } : null,
    total: payable,
    vat: { amount: Math.floor((payable.amount * VAT_PERCENT) / (100 + VAT_PERCENT)), currency },
  };
}

// ---- Confirmation ----

// A reservation as the confirmation page shows it, read back from `GET /me/reservations`: the booking
// as stored, so it does not depend on the address or on the car still being free.
export type Receipt = {
  number: string;
  vehicle: Pick<Vehicle, "brand" | "model" | "dailyPrice">;
  className: { tr: string; en: string };
  pickup: { city: string; name: string };
  dropoff: { city: string; name: string };
  startAt: string;
  endAt: string;
  days: number;
  summary: PriceSummary;
  pointsEarned: number;
};

export function receiptFromApi(reservation: Schemas["Reservation"]): Receipt {
  const price = reservation.price;
  const vehicleLine = price.lines.find((line) => line.type === "VEHICLE");
  // The stored lines say which extra they are by slug; the name and the unit price are what they show.
  const extras: Extra[] = price.lines
    .filter((line) => line.type === "EXTRA")
    .map((line) => ({ slug: line.slug, name: line.label, price: line.unitPrice, pricing: "FIXED" }));
  return {
    number: reservation.number,
    vehicle: {
      brand: reservation.vehicle.model.brand,
      model: reservation.vehicle.model.model,
      dailyPrice: vehicleLine?.unitPrice ?? price.total,
    },
    className: reservation.vehicle.model.class.name,
    pickup: { city: reservation.pickupBranch.city, name: reservation.pickupBranch.name },
    dropoff: { city: reservation.returnBranch.city, name: reservation.returnBranch.name },
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    days: price.days,
    summary: summaryFromApi(price, extras),
    pointsEarned: reservation.pointsEarned,
  };
}
