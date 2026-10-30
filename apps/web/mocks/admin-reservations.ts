import type { AdminReservation, AdminReservationDetail, AdminReservationPage } from "@/lib/admin-reservations";
import { normalizeSearch } from "@/lib/branch-detail";
import type { Reservation } from "@/lib/reservation";
import { listMockBranches } from "./branches";
import { fleetOf } from "./fleet-world";
import { mockReservations } from "./reservations";

// The sample bookings as the panel sees them (USE_MOCKS=1, local work and tests only, lib/mode.ts): the five of the sample
// account (mocks/reservations.ts), with their customer, car and branches. A cancellation from the panel is kept in the sample
// fleet of the world (mocks/fleet-world.ts), so it shows in the panel and in the customer's own list. The sample bookings
// themselves are fixed; a booking made in the sample mode is not here.
const CUSTOMER = { name: "Elif Yıldız", email: "elif.yildiz@example.com" };

function itemOf(world: string, reservation: Reservation, branches: Map<string, { name: string; city: string }>): AdminReservation {
  const fleet = fleetOf(world);
  const cancellation = fleet.cancellations.find((entry) => entry.id === reservation.id);
  const cancelled = reservation.status === "CANCELLED" || Boolean(cancellation);
  const model = fleet.models.find((entry) => entry.brand === reservation.vehicle.brand && entry.model === reservation.vehicle.model);
  // The sample bookings do not name a car: the first one of the model at the pick-up branch (or anywhere) stands for it.
  const car =
    fleet.vehicles.find((entry) => entry.modelSlug === model?.slug && entry.branchId === reservation.pickupBranchId) ??
    fleet.vehicles.find((entry) => entry.modelSlug === model?.slug);
  const branch = (id: string) => ({ id, name: branches.get(id)?.name ?? id, city: branches.get(id)?.city ?? "" });
  return {
    number: reservation.number,
    status: cancelled ? "CANCELLED" : "CONFIRMED",
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    createdAt: new Date(Date.parse(reservation.startAt) - 20 * 86_400_000).toISOString(),
    cancelledAt: cancellation?.at ?? (reservation.status === "CANCELLED" ? reservation.startAt : null),
    customer: CUSTOMER,
    vehicle: { plate: car?.plate ?? "—", brand: reservation.vehicle.brand, model: reservation.vehicle.model },
    pickupBranch: branch(reservation.pickupBranchId),
    returnBranch: branch(reservation.returnBranchId),
    total: { amount: reservation.totalPrice.amount, currency: reservation.totalPrice.currency },
  };
}

function everything(world: string, now: number): AdminReservation[] {
  const page = listMockBranches(world, { page: 1, pageSize: 100, sort: null, q: "", city: null, status: null });
  const branches = new Map(page.items.map((row) => [row.id, { name: row.name, city: row.city }]));
  return mockReservations(now).map((reservation) => itemOf(world, reservation, branches));
}

type ListQuery = {
  page: number;
  pageSize: number;
  sort: { key: string; dir: "asc" | "desc" } | null;
  q: string;
  status: string | null;
  branch: string | null;
  from: string | null;
  to: string | null;
  // The three numbers of the summary as lists (V2-31): today's starts and ends, and what was made in the last seven days.
  startsToday?: boolean;
  endsToday?: boolean;
  madeLast7Days?: boolean;
};

// The days a rental starts on, both included. The sample mode reads the day in UTC, which is close enough for the sample data.
const dayStart = (day: string) => Date.parse(`${day}T00:00:00Z`);

export function listMockAdminReservations(world: string, query: ListQuery, now = Date.now()): AdminReservationPage {
  const needle = normalizeSearch(query.q);
  const today = Math.floor(now / 86_400_000) * 86_400_000;
  const inToday = (iso: string) => Date.parse(iso) >= today && Date.parse(iso) < today + 86_400_000;
  let items = everything(world, now).filter(
    (row) =>
      (!query.startsToday || inToday(row.startAt)) &&
      (!query.endsToday || inToday(row.endAt)) &&
      (!query.madeLast7Days || (Date.parse(row.createdAt) >= today - 6 * 86_400_000 && Date.parse(row.createdAt) < today + 86_400_000)) &&
      (!needle || normalizeSearch(`${row.number} ${row.customer?.email ?? ""}`).includes(needle)) &&
      (!query.status || row.status === query.status) &&
      (!query.branch || row.pickupBranch.id === query.branch) &&
      (!query.from || Date.parse(row.startAt) >= dayStart(query.from)) &&
      (!query.to || Date.parse(row.startAt) < dayStart(query.to) + 86_400_000),
  );
  const sign = query.sort?.dir === "asc" ? 1 : -1;
  const by = (query.sort?.key ?? "startAt") as "startAt" | "createdAt" | "number";
  items = [...items].sort((a, b) => sign * (a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : 0) || a.number.localeCompare(b.number));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}

export function getMockAdminReservation(world: string, number: string, now = Date.now()): AdminReservationDetail | null {
  const item = everything(world, now).find((row) => row.number === number.toUpperCase());
  if (!item) return null;
  const source = mockReservations(now).find((reservation) => reservation.number === item.number)!;
  const cancellation = fleetOf(world).cancellations.find((entry) => entry.id === source.id);
  const unit = Math.round(item.total.amount / source.days);
  const money = (amount: number) => ({ amount, currency: item.total.currency });
  return {
    ...item,
    id: source.id,
    days: source.days,
    customerAccount: { type: "INDIVIDUAL", companyName: null },
    price: {
      currency: item.total.currency,
      exchangeRate: 1,
      days: source.days,
      lines: [
        {
          type: "VEHICLE",
          slug: source.vehicle.model.toLowerCase(),
          label: { tr: `${source.vehicle.brand} ${source.vehicle.model}`, en: `${source.vehicle.brand} ${source.vehicle.model}` },
          quantity: source.days,
          unitPrice: money(unit),
          total: money(unit * source.days),
        },
      ],
      total: item.total,
      promo: null,
      pointsUsed: 0,
      payable: item.total,
    },
    pointsEarned: item.status === "CONFIRMED" ? source.pointsEarned : 0,
    cancellation:
      item.status === "CANCELLED"
        ? { at: item.cancelledAt ?? item.startAt, reason: cancellation?.reason ?? null, by: cancellation ? { name: "Deniz Yönetici", email: "yonetici@novera.example" } : null }
        : null,
    cancellable: item.status === "CONFIRMED" && Date.parse(item.startAt) > now,
  };
}

export type MockOutcome = { status: "ok" } | { status: "not_found" | "not_cancellable" } | { status: "invalid"; fields: Record<string, string> };

// Cancelling from the panel: a confirmed booking that has not started, with a reason of 5 to 500 characters.
export function cancelMockReservation(world: string, number: string, reason: string, now = Date.now()): MockOutcome {
  const detail = getMockAdminReservation(world, number, now);
  if (!detail) return { status: "not_found" };
  const clean = reason.trim();
  if (clean.length < 5 || clean.length > 500) return { status: "invalid", fields: { reason: clean.length < 5 ? "TOO_SHORT" : "TOO_LONG" } };
  if (!detail.cancellable) return { status: "not_cancellable" };
  fleetOf(world).cancellations.push({ id: detail.id, at: new Date(now).toISOString(), reason: clean });
  return { status: "ok" };
}
