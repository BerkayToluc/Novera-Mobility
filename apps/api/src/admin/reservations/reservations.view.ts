import type { AccountType, Currency } from '../../generated/prisma/client.js';
import { toPriceBreakdown, type ReservationRow } from '../../reservations/reservation-view.js';

// What the administrator sees of a booking (V2-31, ADMIN.md §3.2): who, which car, which branches, the price as it was made, and
// whether and why it was cancelled. A customer's name and e-mail are personal data: they are shown here and kept out of the
// audit log, which writes field names only.
export const RESERVATION_STATUSES = ['CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

type Person = { id: string; email: string; firstName: string; lastName: string; accountType: AccountType; companyName: string | null };

// What the list query reads: enough for a row, and for the detail.
export const ADMIN_RESERVATION_INCLUDE = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, accountType: true, companyName: true } },
  cancelledBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  vehicle: { include: { vehicleModel: { include: { class: true } } } },
  pickupBranch: { select: { id: true, name: true, city: true } },
  returnBranch: { select: { id: true, name: true, city: true } },
  extras: { include: { extra: true } },
  pointTransaction: { select: { points: true } },
} as const;

export type AdminReservationRow = Omit<ReservationRow, 'status' | 'currency'> & {
  status: ReservationStatusValue;
  currency: Currency;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
  user: Person | null;
  cancelledBy: { id: string; email: string; firstName: string; lastName: string } | null;
  vehicle: ReservationRow['vehicle'] & { plate: string };
};

export type ReservationListItem = {
  number: string;
  status: ReservationStatusValue;
  startAt: string;
  endAt: string;
  createdAt: string;
  cancelledAt: string | null;
  customer: { name: string; email: string } | null;
  vehicle: { plate: string; brand: string; model: string };
  pickupBranch: { id: string; name: string; city: string };
  returnBranch: { id: string; name: string; city: string };
  // What the booking cost, in its own currency (the minor unit: kuruş, cent).
  total: { amount: number; currency: Currency };
};

export type ReservationDetail = ReservationListItem & {
  id: string;
  days: number;
  customerAccount: { type: AccountType; companyName: string | null } | null;
  // The price as it was when the booking was made, the same shape the customer sees.
  price: ReturnType<typeof toPriceBreakdown>;
  pointsEarned: number;
  cancellation: { at: string; reason: string | null; by: { name: string; email: string } | null } | null;
  // Whether the cancel button works now: a confirmed booking that has not started.
  cancellable: boolean;
};

const nameOf = (person: { firstName: string; lastName: string }): string => `${person.firstName} ${person.lastName}`.trim();

export function reservationListItem(row: AdminReservationRow): ReservationListItem {
  return {
    number: row.number,
    status: row.status,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    customer: row.user ? { name: nameOf(row.user), email: row.user.email } : null,
    vehicle: { plate: row.vehicle.plate, brand: row.vehicle.vehicleModel.brand, model: row.vehicle.vehicleModel.model },
    pickupBranch: row.pickupBranch,
    returnBranch: row.returnBranch,
    total: { amount: row.totalPrice, currency: row.currency },
  };
}

export function reservationDetail(row: AdminReservationRow, now: Date): ReservationDetail {
  return {
    ...reservationListItem(row),
    id: row.id,
    days: row.days,
    customerAccount: row.user ? { type: row.user.accountType, companyName: row.user.companyName } : null,
    price: toPriceBreakdown(row),
    // A cancelled booking earns no points.
    pointsEarned: row.status === 'CONFIRMED' ? (row.pointTransaction?.points ?? 0) : 0,
    cancellation:
      row.status === 'CANCELLED'
        ? {
            at: (row.cancelledAt ?? row.updatedAt).toISOString(),
            reason: row.cancelReason,
            by: row.cancelledBy ? { name: nameOf(row.cancelledBy), email: row.cancelledBy.email } : null,
          }
        : null,
    cancellable: row.status === 'CONFIRMED' && row.startAt.getTime() > now.getTime(),
  };
}

// The number as it is stored: "NVR-2026-00123", in capitals. People type it in any case.
export const NUMBER_FORMAT = /^NVR-\d{4}-\d{4,}$/;
export const normalizeNumber = (raw: string): string | null => {
  const upper = raw.trim().toUpperCase();
  return NUMBER_FORMAT.test(upper) ? upper : null;
};
