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
  // Points the booking earns or has earned (SPEC §2.9); a cancelled booking earns none.
  pointsEarned: number;
};
