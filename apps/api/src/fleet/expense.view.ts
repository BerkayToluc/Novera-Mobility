import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { assigneeAt, type ExpenseStatus, type ExpenseType } from './expense-calc.js';
import { EMPLOYEE_SELECT, fullName } from './fleet.view.js';

// What an expense looks like on the screens, for the customer (`/fleet/expenses`) and for the administrator (`/admin/fleet-expenses`) alike
// (V2-38, docs/FLEET.md §4). Money is TRY kuruş. The person is worked out from the assignments when the expense is read, never stored.
export const EXPENSE_INCLUDE = {
  vehicle: {
    select: {
      id: true,
      plate: true,
      vehicleModel: { select: { brand: true, model: true } },
      contract: { select: { number: true, company: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.FleetExpenseInclude;
export type ExpenseRow = Prisma.FleetExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;

export type ExpenseEmployee = { id: string; name: string; department: string | null };

export type ExpenseView = {
  id: string;
  company: { id: string; name: string };
  vehicle: { id: string; plate: string; model: string; contractNumber: string };
  type: ExpenseType;
  occurredAt: string;
  amount: number;
  description: string | null;
  place: string | null;
  status: ExpenseStatus;
  // Who had the car at `occurredAt`; null is "Atanmamış" (nobody did).
  employee: ExpenseEmployee | null;
  createdAt: string;
  updatedAt: string;
};

type Span = { employeeId: string; startedAt: Date; endedAt: Date | null; employee: { id: string; firstName: string; lastName: string; department: string | null } };
export type AssigneeIndex = Map<string, Span[]>;

// The assignments that can matter for these expenses, one query for the whole page: of the cars on it, those that started by the last
// expense and had not ended before the first. The rest is the pure rule of `assigneeAt`.
export async function loadAssignees(prisma: Pick<PrismaService, 'vehicleAssignment'>, rows: readonly { fleetVehicleId: string; occurredAt: Date }[]): Promise<AssigneeIndex> {
  const index: AssigneeIndex = new Map();
  if (rows.length === 0) return index;
  const times = rows.map((row) => row.occurredAt.getTime());
  const spans = await prisma.vehicleAssignment.findMany({
    where: {
      fleetVehicleId: { in: [...new Set(rows.map((row) => row.fleetVehicleId))] },
      startedAt: { lte: new Date(Math.max(...times)) },
      OR: [{ endedAt: null }, { endedAt: { gt: new Date(Math.min(...times)) } }],
    },
    select: { fleetVehicleId: true, employeeId: true, startedAt: true, endedAt: true, employee: { select: EMPLOYEE_SELECT } },
  });
  for (const span of spans) index.set(span.fleetVehicleId, [...(index.get(span.fleetVehicleId) ?? []), span]);
  return index;
}

export function employeeOf(index: AssigneeIndex, row: { fleetVehicleId: string; occurredAt: Date }): ExpenseEmployee | null {
  const span = assigneeAt(index.get(row.fleetVehicleId) ?? [], row.occurredAt);
  return span ? { id: span.employee.id, name: fullName(span.employee), department: span.employee.department } : null;
}

export function expenseView(row: ExpenseRow, index: AssigneeIndex): ExpenseView {
  return {
    id: row.id,
    company: row.vehicle.contract.company,
    vehicle: {
      id: row.vehicle.id,
      plate: row.vehicle.plate,
      model: `${row.vehicle.vehicleModel.brand} ${row.vehicle.vehicleModel.model}`,
      contractNumber: row.vehicle.contract.number,
    },
    type: row.type,
    occurredAt: row.occurredAt.toISOString(),
    amount: row.amount,
    description: row.description,
    place: row.place,
    status: row.status,
    employee: employeeOf(index, row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function expenseViews(prisma: Pick<PrismaService, 'vehicleAssignment'>, rows: readonly ExpenseRow[]): Promise<ExpenseView[]> {
  const index = await loadAssignees(prisma, rows);
  return rows.map((row) => expenseView(row, index));
}
