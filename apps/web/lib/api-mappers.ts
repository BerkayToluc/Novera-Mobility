import type { components } from "./api-types";
import type { PointsAccount } from "./points";
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
