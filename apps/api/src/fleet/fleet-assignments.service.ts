import { Inject, Injectable } from '@nestjs/common';
import type { Page } from '../admin/admin-list.js';
import { invalidTransition } from '../admin/admin.errors.js';
import { MINUTE_MS } from '../common/time.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { isUuid } from '../common/uuid.js';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fleetNotFound, vehicleAssigned } from './fleet.errors.js';
import { createAssignmentSchema, endAssignmentSchema, listAssignmentSchema } from './fleet.schemas.js';
import { assignmentView, ASSIGNMENT_INCLUDE, type AssignmentView } from './fleet.view.js';

// How far ahead of the clock a moment may be: a minute, for the clocks of two computers that do not agree.
const CLOCK_SLACK_MS = MINUTE_MS;

// Giving a car to a person and taking it back (V2-35, docs/FLEET.md §3.1, §4.1). A car has at most one open assignment: the service
// says so first (`409 VEHICLE_ASSIGNED`), and the database holds it when two requests arrive together (a partial unique index).
// Every query takes the company and filters by it first (ADR-25).
@Injectable()
export class FleetAssignmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, query: unknown): Promise<Page<AssignmentView>> {
    const input = parseInput(listAssignmentSchema, query, 'Assignment list query is invalid');
    const where: Prisma.VehicleAssignmentWhereInput = {
      companyId,
      ...(input.vehicle ? { fleetVehicleId: input.vehicle } : {}),
      ...(input.employee ? { employeeId: input.employee } : {}),
      ...(input.open === null ? {} : { endedAt: input.open ? null : { not: null } }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.vehicleAssignment.count({ where }),
      this.prisma.vehicleAssignment.findMany({
        where,
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(assignmentView), total, page: input.page, pageSize: input.pageSize };
  }

  // The car is locked first, so two assignments of one car take turns: the second finds the first and is refused. A car or a person
  // that is not found (or is another company's) is a field problem, the same answer for both: it says nothing about other companies.
  async create(companyId: string, body: unknown, now: Date = new Date()): Promise<AssignmentView> {
    const input = parseInput(createAssignmentSchema, body, 'Assignment validation failed');
    const startedAt = input.startedAt ?? now;
    if (startedAt.getTime() > now.getTime() + CLOCK_SLACK_MS) throw validationFailed({ startedAt: 'OUT_OF_RANGE' }, 'An assignment cannot start in the future');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "FleetVehicle" WHERE "id" = ${input.fleetVehicleId} AND "companyId" = ${companyId} FOR UPDATE`;
        const vehicle = await tx.fleetVehicle.findFirst({ where: { id: input.fleetVehicleId, companyId }, select: { id: true, status: true } });
        if (!vehicle) throw validationFailed({ fleetVehicleId: 'UNKNOWN_REFERENCE' }, 'No such vehicle');
        const employee = await tx.companyEmployee.findFirst({ where: { id: input.employeeId, companyId }, select: { id: true, active: true } });
        if (!employee) throw validationFailed({ employeeId: 'UNKNOWN_REFERENCE' }, 'No such employee');
        if (!employee.active) throw validationFailed({ employeeId: 'NOT_ALLOWED' }, 'The employee is inactive');
        if (vehicle.status !== 'ACTIVE') throw invalidTransition('The vehicle has been returned and cannot be given to anyone');

        const history = await tx.vehicleAssignment.findMany({ where: { fleetVehicleId: vehicle.id, companyId }, select: { endedAt: true }, orderBy: [{ startedAt: 'desc' }], take: 1 });
        const last = history[0];
        if (last && last.endedAt === null) throw vehicleAssigned();
        // The history does not overlap: a new assignment starts when the last one has ended or later.
        if (last?.endedAt && startedAt.getTime() < last.endedAt.getTime()) throw validationFailed({ startedAt: 'OUT_OF_RANGE' }, 'The previous assignment ended later than this one starts');

        const row = await tx.vehicleAssignment.create({
          data: { companyId, fleetVehicleId: vehicle.id, employeeId: employee.id, startedAt, note: input.note },
          include: ASSIGNMENT_INCLUDE,
        });
        return assignmentView(row);
      });
    } catch (error) {
      // Two requests at once: the lock above makes them take turns, and this is the database's own word if one still got through.
      if (isUniqueViolation(error)) throw vehicleAssigned();
      throw error;
    }
  }

  async end(companyId: string, id: string, body: unknown, now: Date = new Date()): Promise<AssignmentView> {
    if (!isUuid(id)) throw fleetNotFound('Assignment');
    const input = parseInput(endAssignmentSchema, body ?? {}, 'Assignment validation failed');
    const endedAt = input.endedAt ?? now;
    if (endedAt.getTime() > now.getTime() + CLOCK_SLACK_MS) throw validationFailed({ endedAt: 'OUT_OF_RANGE' }, 'An assignment cannot end in the future');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "VehicleAssignment" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
      const current = await tx.vehicleAssignment.findFirst({ where: { id, companyId } });
      if (!current) throw fleetNotFound('Assignment');
      if (current.endedAt) throw invalidTransition('The assignment has ended already');
      if (endedAt.getTime() < current.startedAt.getTime()) throw validationFailed({ endedAt: 'OUT_OF_RANGE' }, 'An assignment cannot end before it starts');
      const row = await tx.vehicleAssignment.update({ where: { id }, data: { endedAt }, include: ASSIGNMENT_INCLUDE });
      return assignmentView(row);
    });
  }
}
