import { Inject, Injectable } from '@nestjs/common';
import type { Page } from '../admin/admin-list.js';
import { normalizePlate } from '../admin/vehicles/vehicles.view.js';
import { parseInput } from '../common/zod-validation.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fleetNotFound } from './fleet.errors.js';
import { listFleetVehicleSchema } from './fleet.schemas.js';
import {
  ASSIGNMENT_INCLUDE,
  assignmentView,
  readingView,
  vehicleView,
  VEHICLE_INCLUDE,
  type AssignmentView,
  type FleetVehicleView,
  type ReadingView,
} from './fleet.view.js';

export type FleetVehicleDetail = FleetVehicleView & {
  // Every assignment of the car, the open one first, then the newest.
  assignments: AssignmentView[];
  // The latest readings, newest first.
  readings: ReadingView[];
};

const RECENT_READINGS = 10;

// "34abc123" is "34 ABC 123" to a person who looks for a plate: a space goes in where digits meet letters, so the search finds
// the plate however it was typed.
const spaced = (word: string): string => word.replace(/(\d)([A-Za-z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2');

// The fleet vehicles of the signed-in company (V2-35, docs/FLEET.md §4.1). Every query takes the company and filters by it first: a
// car of another company is never found, so it is a 404 like one that does not exist (ADR-25).
@Injectable()
export class FleetVehiclesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, query: unknown): Promise<Page<FleetVehicleView>> {
    const input = parseInput(listFleetVehicleSchema, query, 'Vehicle list query is invalid');
    const words = (input.q ?? '').split(/\s+/).filter(Boolean).slice(0, 4);
    const where: Prisma.FleetVehicleWhereInput = {
      companyId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.contract ? { contract: { number: input.contract } } : {}),
      ...(input.assigned === true ? { assignments: { some: { endedAt: null } } } : input.assigned === false ? { assignments: { none: { endedAt: null } } } : {}),
      ...(words.length
        ? {
            AND: words.map((word) => ({
              OR: [
                { plate: { contains: spaced(word), mode: 'insensitive' as const } },
                { vehicleModel: { is: { brand: { contains: word, mode: 'insensitive' as const } } } },
                { vehicleModel: { is: { model: { contains: word, mode: 'insensitive' as const } } } },
              ],
            })),
          }
        : {}),
    };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.fleetVehicle.count({ where }),
      this.prisma.fleetVehicle.findMany({
        where,
        include: VEHICLE_INCLUDE,
        // The id as the last key: cars that share a value still come in one order, so a page never repeats or skips one.
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items: rows.map(vehicleView), total, page: input.page, pageSize: input.pageSize };
  }

  // By plate, written any way ("34abc123", "34 ABC 123"). One that cannot be a plate does not exist.
  async get(companyId: string, rawPlate: string): Promise<FleetVehicleDetail> {
    const plate = normalizePlate(rawPlate);
    if (!plate) throw fleetNotFound('Vehicle');
    const row = await this.prisma.fleetVehicle.findFirst({ where: { companyId, plate }, include: VEHICLE_INCLUDE });
    if (!row) throw fleetNotFound('Vehicle');
    const [assignments, readings] = await Promise.all([
      this.prisma.vehicleAssignment.findMany({
        where: { companyId, fleetVehicleId: row.id },
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.vehicleReading.findMany({ where: { fleetVehicleId: row.id }, orderBy: [{ at: 'desc' }, { id: 'asc' }], take: RECENT_READINGS }),
    ]);
    return { ...vehicleView(row), assignments: assignments.map(assignmentView), readings: readings.map(readingView) };
  }
}
