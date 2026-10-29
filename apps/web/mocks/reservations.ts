import { pointsForTotal } from "@/lib/points";
import type { PointsAccount } from "@/lib/points";
import type { Reservation } from "@/lib/reservation";

// Sample reservations of the individual sample account (BACKLOG Y43, Y44): two coming up, three
// behind it (one of them cancelled, which earns nothing). Their dates are worked out from the time
// of the call, not fixed, so the ones "coming up" never turn into past ones as the calendar moves
// (the tests that cancel one, and the points that wait for another, depend on that).
const total = (lira: number) => ({ amount: lira * 100, currency: "TRY" as const });

const DAY_MS = 24 * 60 * 60 * 1000;

// `days` from the start of today (UTC), at the given time of day.
const dayAt = (now: number, days: number, time: string) => {
  const midnight = Math.floor(now / DAY_MS) * DAY_MS;
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(midnight + days * DAY_MS + hours * 3_600_000 + minutes * 60_000).toISOString().replace(".000Z", "Z");
};

type Draft = Omit<Reservation, "pointsEarned">;

const drafts = (now: number): Draft[] => [
  {
    id: "r5",
    number: "NVR-2026-00231",
    status: "CONFIRMED",
    startAt: dayAt(now, 30, "09:00"),
    endAt: dayAt(now, 33, "18:00"),
    days: 3,
    totalPrice: total(4860),
    vehicle: { brand: "Volkswagen", model: "Passat", imageUrl: "/fleet/volkswagen-passat.webp" },
    pickupCity: "İstanbul",
    returnCity: "İzmir",
    pickupBranchId: "istanbul-kadikoy",
    returnBranchId: "izmir-adnan-menderes",
  },
  {
    id: "r4",
    number: "NVR-2026-00207",
    status: "CONFIRMED",
    startAt: dayAt(now, 2, "10:00"),
    endAt: dayAt(now, 4, "10:00"),
    days: 2,
    totalPrice: total(2790),
    vehicle: { brand: "Renault", model: "Clio", imageUrl: "/fleet/renault-clio.webp" },
    pickupCity: "Ankara",
    returnCity: "Ankara",
    pickupBranchId: "ankara-esenboga",
    returnBranchId: "ankara-esenboga",
  },
  {
    id: "r3",
    number: "NVR-2026-00142",
    status: "CONFIRMED",
    startAt: dayAt(now, -75, "08:30"),
    endAt: dayAt(now, -68, "08:30"),
    days: 7,
    totalPrice: total(11340),
    vehicle: { brand: "Toyota", model: "Corolla Hybrid", imageUrl: "/fleet/toyota-corolla-hybrid.webp" },
    pickupCity: "Antalya",
    returnCity: "Antalya",
    pickupBranchId: "antalya-havalimani",
    returnBranchId: "antalya-havalimani",
  },
  {
    id: "r2",
    number: "NVR-2026-00098",
    status: "CANCELLED",
    startAt: dayAt(now, -125, "12:00"),
    endAt: dayAt(now, -123, "12:00"),
    days: 2,
    totalPrice: total(3120),
    vehicle: { brand: "Toyota", model: "RAV4 Hybrid", imageUrl: null },
    pickupCity: "İzmir",
    returnCity: "İzmir",
    pickupBranchId: "izmir-adnan-menderes",
    returnBranchId: "izmir-adnan-menderes",
  },
  {
    id: "r1",
    number: "NVR-2026-00031",
    status: "CONFIRMED",
    startAt: dayAt(now, -210, "09:00"),
    endAt: dayAt(now, -207, "09:00"),
    days: 3,
    totalPrice: total(5230),
    vehicle: { brand: "Fiat", model: "Egea", imageUrl: "/fleet/fiat-egea.webp" },
    pickupCity: "İstanbul",
    returnCity: "Bursa",
    pickupBranchId: "istanbul-kadikoy",
    returnBranchId: "bursa-nilufer",
  },
];

// Points follow the rule, never typed by hand, so the fixture cannot disagree with it.
export function mockReservations(now: number = Date.now()): Reservation[] {
  return drafts(now).map((draft) => ({
    ...draft,
    pointsEarned: draft.status === "CONFIRMED" ? pointsForTotal(draft.totalPrice) : 0,
  }));
}

// The sample bookings with the ones this browser cancelled marked as such (a cancelled booking
// earns no points). `cancelled` is the list of ids kept in the cookie.
export function withCancelled(cancelled: string[], now: number = Date.now()): Reservation[] {
  return mockReservations(now).map((reservation) =>
    cancelled.includes(reservation.id) ? { ...reservation, status: "CANCELLED" as const, pointsEarned: 0 } : reservation,
  );
}

// Points are credited when a rental is completed; a booking still ahead only has points pending.
export function mockPoints(now: Date, reservations: Reservation[] = mockReservations(now.getTime())): PointsAccount {
  const confirmed = reservations.filter((reservation) => reservation.status === "CONFIRMED");
  const done = confirmed.filter((reservation) => new Date(reservation.endAt) <= now);
  const ahead = confirmed.filter((reservation) => new Date(reservation.endAt) > now);
  return {
    balance: done.reduce((sum, reservation) => sum + reservation.pointsEarned, 0),
    pending: ahead.reduce((sum, reservation) => sum + reservation.pointsEarned, 0),
    history: done.map((reservation) => ({
      points: reservation.pointsEarned,
      reservationNumber: reservation.number,
      createdAt: reservation.endAt,
    })),
  };
}
