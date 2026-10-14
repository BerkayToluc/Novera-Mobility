import type { Money } from "./currency";

// Interim shape, mirroring the Prisma model; BACKLOG #12 replaces it with the type
// generated from openapi.yaml. Prices are a Money: whole kuruş or cents plus the currency.
export type ReservationStatus = "CONFIRMED" | "CANCELLED";

export type Reservation = {
  id: string;
  number: string;
  status: ReservationStatus;
  startAt: string;
  endAt: string;
  days: number;
  totalPrice: Money;
  vehicle: { brand: string; model: string };
  pickupCity: string;
  returnCity: string;
  // The branches, for the name, the way there and the phone number (SPEC §2.9, v0.8).
  pickupBranchId: string;
  returnBranchId: string;
  // Points the booking earns or has earned (SPEC §2.9); a cancelled booking earns none.
  pointsEarned: number;
};

// The sample bookings this browser has cancelled (USE_MOCKS=1 only), a comma-separated list of ids.
export const CANCELLED_COOKIE = "novera-cancelled";

// Where a booking is in its life, worked out from its dates and status (the API sends only the
// status): ahead of the visitor, under way, finished, or cancelled.
export type ReservationPhase = "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export function reservationPhase(reservation: Reservation, now: number): ReservationPhase {
  if (reservation.status === "CANCELLED") return "CANCELLED";
  if (new Date(reservation.startAt).getTime() > now) return "UPCOMING";
  if (new Date(reservation.endAt).getTime() > now) return "ACTIVE";
  return "COMPLETED";
}

// A booking can be cancelled without a charge until 24 hours before it starts (the rental
// conditions); later it can still be cancelled here, and the dialog says it is not free.
export const FREE_CANCELLATION_MS = 24 * 60 * 60 * 1000;

export const cancelsForFree = (reservation: Reservation, now: number) =>
  new Date(reservation.startAt).getTime() - now >= FREE_CANCELLATION_MS;
