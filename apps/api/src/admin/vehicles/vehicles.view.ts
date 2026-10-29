import { fold } from '../admin-list.js';

// What the administrator sees of a car (V2-30, ADMIN.md §3.1): the plate, the year, which model and branch it belongs to, and
// whether it is switched on for rent.
export const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

// What keeps a car where it is and switched on (the reasons a removing or a move is refused): bookings that start in the future
// with it, and holds still running on it.
export type VehicleUsage = { reservations: number; holds: number };

type Row = {
  id: string;
  plate: string;
  year: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  vehicleModel: { slug: string; brand: string; model: string; retiredAt: Date | null };
  branch: { id: string; name: string; city: string; closedAt: Date | null };
};

export type VehicleView = {
  id: string;
  plate: string;
  year: number;
  status: VehicleStatus;
  model: { slug: string; brand: string; model: string; retired: boolean };
  branch: { id: string; name: string; city: string; closed: boolean };
  createdAt: string;
  // The version of the record: an edit sends it back and is refused (STALE_WRITE) if the record moved on.
  updatedAt: string;
};

export function vehicleAdminView(row: Row): VehicleView {
  return {
    id: row.id,
    plate: row.plate,
    year: row.year,
    status: row.active ? 'ACTIVE' : 'INACTIVE',
    model: {
      slug: row.vehicleModel.slug,
      brand: row.vehicleModel.brand,
      model: row.vehicleModel.model,
      retired: row.vehicleModel.retiredAt !== null,
    },
    branch: { id: row.branch.id, name: row.branch.name, city: row.branch.city, closed: row.branch.closedAt !== null },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------- The plate ----------
// A Turkish plate: the province code (01 to 81), one to three letters and two to four digits, written "34 ABC 123". People type
// it every way ("34abc123", "34-ABC-123", "34 abc 123"), so it is read without the separators, put in capitals, and stored in
// the one form. The letters Q, W and X are not on Turkish plates, and neither are the Turkish letters.
const PLATE = /^(0[1-9]|[1-7]\d|8[01])([ABCDEFGHIJKLMNOPRSTUVYZ]{1,3})(\d{2,4})$/;

// The stored form of a plate, or `null` when what was typed cannot be one.
export function normalizePlate(raw: string): string | null {
  const compact = raw.replace(/[\s.\-_]/g, '').toUpperCase();
  const match = PLATE.exec(compact);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : null;
}

// The part of a plate a person searches for: no separators, no case.
export const plateKey = (plate: string): string => fold(plate).replace(/\s+/g, '');
