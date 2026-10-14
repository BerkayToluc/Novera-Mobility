import { pointsForTotal } from "@/lib/points";
import type { PointsAccount } from "@/lib/points";
import type { Reservation } from "@/lib/reservation";

// Sample reservations of the individual sample account (BACKLOG Y43, Y44), around 10 October
// 2026: two coming up, three behind it (one of them cancelled, which earns nothing).
const total = (lira: number) => ({ amount: lira * 100, currency: "TRY" as const });

type Draft = Omit<Reservation, "pointsEarned">;

const DRAFTS: Draft[] = [
  {
    id: "r5",
    number: "NVR-2026-00231",
    status: "CONFIRMED",
    startAt: "2026-11-06T09:00:00Z",
    endAt: "2026-11-09T18:00:00Z",
    days: 3,
    totalPrice: total(4860),
    vehicle: { brand: "Volkswagen", model: "Passat" },
    pickupCity: "İstanbul",
    returnCity: "İzmir",
    pickupBranchId: "istanbul-kadikoy",
    returnBranchId: "izmir-adnan-menderes",
  },
  {
    id: "r4",
    number: "NVR-2026-00207",
    status: "CONFIRMED",
    startAt: "2026-10-18T10:00:00Z",
    endAt: "2026-10-20T10:00:00Z",
    days: 2,
    totalPrice: total(2790),
    vehicle: { brand: "Renault", model: "Clio" },
    pickupCity: "Ankara",
    returnCity: "Ankara",
    pickupBranchId: "ankara-esenboga",
    returnBranchId: "ankara-esenboga",
  },
  {
    id: "r3",
    number: "NVR-2026-00142",
    status: "CONFIRMED",
    startAt: "2026-08-02T08:30:00Z",
    endAt: "2026-08-09T08:30:00Z",
    days: 7,
    totalPrice: total(11340),
    vehicle: { brand: "Toyota", model: "Corolla Hybrid" },
    pickupCity: "Antalya",
    returnCity: "Antalya",
    pickupBranchId: "antalya-havalimani",
    returnBranchId: "antalya-havalimani",
  },
  {
    id: "r2",
    number: "NVR-2026-00098",
    status: "CANCELLED",
    startAt: "2026-06-12T12:00:00Z",
    endAt: "2026-06-14T12:00:00Z",
    days: 2,
    totalPrice: total(3120),
    vehicle: { brand: "Hyundai", model: "Tucson" },
    pickupCity: "İzmir",
    returnCity: "İzmir",
    pickupBranchId: "izmir-adnan-menderes",
    returnBranchId: "izmir-adnan-menderes",
  },
  {
    id: "r1",
    number: "NVR-2026-00031",
    status: "CONFIRMED",
    startAt: "2026-03-20T09:00:00Z",
    endAt: "2026-03-23T09:00:00Z",
    days: 3,
    totalPrice: total(5230),
    vehicle: { brand: "Fiat", model: "Egea" },
    pickupCity: "İstanbul",
    returnCity: "Bursa",
    pickupBranchId: "istanbul-kadikoy",
    returnBranchId: "bursa-nilufer",
  },
];

// Points follow the rule, never typed by hand, so the fixture cannot disagree with it.
export const MOCK_RESERVATIONS: Reservation[] = DRAFTS.map((draft) => ({
  ...draft,
  pointsEarned: draft.status === "CONFIRMED" ? pointsForTotal(draft.totalPrice) : 0,
}));

// The sample bookings with the ones this browser cancelled marked as such (a cancelled booking
// earns no points). `cancelled` is the list of ids kept in the cookie.
export function withCancelled(cancelled: string[]): Reservation[] {
  return MOCK_RESERVATIONS.map((reservation) =>
    cancelled.includes(reservation.id) ? { ...reservation, status: "CANCELLED" as const, pointsEarned: 0 } : reservation,
  );
}

// Points are credited when a rental is completed; a booking still ahead only has points pending.
export function mockPoints(now: Date, reservations: Reservation[] = MOCK_RESERVATIONS): PointsAccount {
  const confirmed = reservations.filter((reservation) => reservation.status === "CONFIRMED");
  const done = confirmed.filter((reservation) => new Date(reservation.endAt) <= now);
  const ahead = confirmed.filter((reservation) => new Date(reservation.endAt) > now);
  return {
    balance: done.reduce((sum, reservation) => sum + reservation.pointsEarned, 0),
    pending: ahead.reduce((sum, reservation) => sum + reservation.pointsEarned, 0),
    entries: done.map((reservation) => ({
      id: reservation.id,
      date: reservation.endAt,
      reservationNumber: reservation.number,
      points: reservation.pointsEarned,
    })),
  };
}
