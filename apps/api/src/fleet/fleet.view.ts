import type { Prisma } from '../generated/prisma/client.js';
import { dayOf, daysBetween } from './fleet-dates.js';

// What the fleet looks like on the screens, for the customer (`/fleet/*`) and for the administrator (`/admin/contracts/*`) alike
// (V2-35, docs/FLEET.md §4). Money is TRY in kuruş (ADR-25). The days are calendar days, "2026-10-31".
export const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, department: true } as const;

export const VEHICLE_INCLUDE = {
  contract: { select: { number: true, product: { select: { slug: true } } } },
  vehicleModel: { select: { slug: true, brand: true, model: true } },
  assignments: { where: { endedAt: null }, take: 1, include: { employee: { select: EMPLOYEE_SELECT } } },
  readings: { orderBy: [{ at: 'desc' }, { id: 'asc' }], take: 1 },
} satisfies Prisma.FleetVehicleInclude;
export type VehicleRow = Prisma.FleetVehicleGetPayload<{ include: typeof VEHICLE_INCLUDE }>;

export type FleetVehicleView = {
  id: string;
  plate: string;
  model: { slug: string; brand: string; model: string };
  year: number;
  contract: { number: string; productSlug: string };
  status: 'ACTIVE' | 'RETURNED';
  startKm: number;
  // The kilometre of the latest reading, or the one the car started with when there is none.
  lastKm: number;
  lastReadingAt: string | null;
  // Who has the car now (the open assignment), if anyone.
  assignee: { employeeId: string; name: string; department: string | null; since: string } | null;
  nextMaintenanceOn: string | null;
  inspectionDueOn: string | null;
  returnedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const fullName = (person: { firstName: string; lastName: string }): string => `${person.firstName} ${person.lastName}`.trim();

export function vehicleView(row: VehicleRow): FleetVehicleView {
  const open = row.assignments[0] ?? null;
  const latest = row.readings[0] ?? null;
  return {
    id: row.id,
    plate: row.plate,
    model: row.vehicleModel,
    year: row.year,
    contract: { number: row.contract.number, productSlug: row.contract.product.slug },
    status: row.status,
    startKm: row.startKm,
    lastKm: latest?.km ?? row.startKm,
    lastReadingAt: latest?.at.toISOString() ?? null,
    assignee: open ? { employeeId: open.employee.id, name: fullName(open.employee), department: open.employee.department, since: open.startedAt.toISOString() } : null,
    nextMaintenanceOn: dayOf(row.nextMaintenanceOn),
    inspectionDueOn: dayOf(row.inspectionDueOn),
    returnedAt: row.returnedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ReadingView = {
  id: string;
  at: string;
  km: number;
  fuelPercent: number | null;
  chargePercent: number | null;
  batteryHealthPercent: number | null;
  source: 'MANUAL' | 'SEED';
};

export const readingView = (row: {
  id: string;
  at: Date;
  km: number;
  fuelPercent: number | null;
  chargePercent: number | null;
  batteryHealthPercent: number | null;
  source: 'MANUAL' | 'SEED';
}): ReadingView => ({
  id: row.id,
  at: row.at.toISOString(),
  km: row.km,
  fuelPercent: row.fuelPercent,
  chargePercent: row.chargePercent,
  batteryHealthPercent: row.batteryHealthPercent,
  source: row.source,
});

// ---------- Employees and assignments ----------
export const EMPLOYEE_INCLUDE = {
  assignments: { where: { endedAt: null }, take: 1, include: { vehicle: { select: { plate: true } } } },
} satisfies Prisma.CompanyEmployeeInclude;
export type EmployeeRow = Prisma.CompanyEmployeeGetPayload<{ include: typeof EMPLOYEE_INCLUDE }>;

export type EmployeeView = {
  id: string;
  firstName: string;
  lastName: string;
  department: string | null;
  employeeNo: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  // The plate of the car they have now, if any.
  vehicle: { plate: string } | null;
  createdAt: string;
  updatedAt: string;
};

export const employeeView = (row: EmployeeRow): EmployeeView => ({
  id: row.id,
  firstName: row.firstName,
  lastName: row.lastName,
  department: row.department,
  employeeNo: row.employeeNo,
  email: row.email,
  phone: row.phone,
  active: row.active,
  vehicle: row.assignments[0] ? { plate: row.assignments[0].vehicle.plate } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const ASSIGNMENT_INCLUDE = {
  vehicle: { select: { id: true, plate: true } },
  employee: { select: EMPLOYEE_SELECT },
} satisfies Prisma.VehicleAssignmentInclude;
export type AssignmentRow = Prisma.VehicleAssignmentGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;

export type AssignmentView = {
  id: string;
  vehicle: { id: string; plate: string };
  employee: { id: string; name: string; department: string | null };
  startedAt: string;
  // Empty while the assignment is open.
  endedAt: string | null;
  note: string | null;
};

export const assignmentView = (row: AssignmentRow): AssignmentView => ({
  id: row.id,
  vehicle: row.vehicle,
  employee: { id: row.employee.id, name: fullName(row.employee), department: row.employee.department },
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString() ?? null,
  note: row.note,
});

// ---------- Contracts ----------
export const CONTRACT_INCLUDE = {
  product: { select: { slug: true } },
  company: { select: { id: true, name: true } },
  _count: { select: { vehicles: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.FleetContractInclude;
export type ContractRow = Prisma.FleetContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>;

export type ContractView = {
  id: string;
  number: string;
  company: { id: string; name: string };
  productSlug: string;
  startAt: string;
  endAt: string;
  // TRY kuruş.
  monthlyFee: number;
  deliveryCity: string;
  status: 'ACTIVE' | 'ENDED';
  // The cars still with the company (not returned).
  vehicleCount: number;
  // Days left until the contract ends; 0 once it has ended or the day has come.
  remainingDays: number;
  createdAt: string;
  updatedAt: string;
};

// `today` is the Istanbul calendar day as a Date at 00:00 UTC (parseDay of istanbulDay), the same form the `date` columns have.
export const contractView = (row: ContractRow, today: Date): ContractView => ({
  id: row.id,
  number: row.number,
  company: row.company,
  productSlug: row.product.slug,
  startAt: dayOf(row.startAt)!,
  endAt: dayOf(row.endAt)!,
  monthlyFee: row.monthlyFee,
  deliveryCity: row.deliveryCity,
  status: row.status,
  vehicleCount: row._count.vehicles,
  remainingDays: row.status === 'ENDED' ? 0 : Math.max(0, daysBetween(today, row.endAt)),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type ContractDetail = ContractView & { vehicles: FleetVehicleView[] };

// A contract number in the path, as it is stored: capitals. Something that cannot be a number is a record that does not exist.
export const CONTRACT_NUMBER = /^SZL-\d{4}-\d{5,}$/;
export const normalizeContractNumber = (raw: string): string | null => {
  const number = raw.trim().toUpperCase();
  return CONTRACT_NUMBER.test(number) ? number : null;
};
