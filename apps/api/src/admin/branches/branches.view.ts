import type { Branch, BranchKind } from '../../generated/prisma/client.js';

// What the administrator sees of a branch (V2-27, ADMIN.md §3.1): the stored fields, whether it is open, and how many cars
// it has.
export const BRANCH_KINDS = ['CITY', 'AIRPORT'] as const satisfies readonly BranchKind[];
export const BRANCH_STATUSES = ['OPEN', 'CLOSED'] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

// One day: `HH:MM-HH:MM`, or `closed`. The same text the public `GET /branches` has always carried.
export type OpeningHours = { weekdays: string; saturday: string; sunday: string };
export const CLOSED_DAY = 'closed';
const HOURS = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

// A day's hours are valid when it is `closed`, or an opening time before a closing time in the same day. (A desk that is open
// through midnight is two days' worth of hours, and none of our branches is.)
export function isValidDay(value: string): boolean {
  if (value === CLOSED_DAY) return true;
  const match = HOURS.exec(value);
  if (!match) return false;
  return `${match[1]}:${match[2]}` < `${match[3]}:${match[4]}`;
}

export type BranchView = {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  kind: BranchKind;
  openingHours: OpeningHours;
  status: BranchStatus;
  closedAt: string | null;
  // Cars on the road from this branch that are switched on; a branch with none and nothing booked can be closed.
  activeVehicles: number;
  createdAt: string;
  // The version of the record: an edit sends it back and is refused (STALE_WRITE) if the record moved on.
  updatedAt: string;
};

// What keeps a branch open (the reasons a closing is refused): bookings that start or end there in the future, holds that
// are still running, and cars that are switched on.
export type BranchUsage = { reservations: number; holds: number; vehicles: number };

export function branchView(row: Branch, activeVehicles: number): BranchView {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    email: row.email,
    kind: row.kind,
    openingHours: row.openingHours as OpeningHours,
    status: row.closedAt ? 'CLOSED' : 'OPEN',
    closedAt: row.closedAt?.toISOString() ?? null,
    activeVehicles,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Searching by hand is shared by every list (admin-list.ts).
export { fold } from '../admin-list.js';
