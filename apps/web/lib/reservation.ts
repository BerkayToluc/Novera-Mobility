// Interim shape, mirroring the Prisma model; BACKLOG #12 replaces it with the type
// generated from openapi.yaml. Prices are whole kuruş (125000 = ₺1.250), as agreed.
export type ReservationStatus = "CONFIRMED" | "CANCELLED";

export type Reservation = {
  id: string;
  number: string;
  status: ReservationStatus;
  startAt: string;
  endAt: string;
  days: number;
  totalPrice: number;
  vehicle: { brand: string; model: string };
  pickupCity: string;
  returnCity: string;
};
