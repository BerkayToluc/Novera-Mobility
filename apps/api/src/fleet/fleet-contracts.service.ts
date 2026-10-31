import { Inject, Injectable } from '@nestjs/common';
import type { Page } from '../admin/admin-list.js';
import { istanbulDay } from '../common/time.js';
import { parseInput } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseDay } from './fleet-dates.js';
import { fleetNotFound } from './fleet.errors.js';
import { listFleetContractSchema } from './fleet.schemas.js';
import { contractView, CONTRACT_INCLUDE, normalizeContractNumber, vehicleView, VEHICLE_INCLUDE, type ContractDetail, type ContractView } from './fleet.view.js';

// The contracts of the signed-in company (V2-35, docs/FLEET.md §4.1). A company without a contract gets an empty list, not an error.
@Injectable()
export class FleetContractsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(companyId: string, query: unknown, now: Date = new Date()): Promise<Page<ContractView>> {
    const input = parseInput(listFleetContractSchema, query, 'Contract list query is invalid');
    const where = { companyId, ...(input.status ? { status: input.status } : {}) };
    const { field, direction } = input.sort;
    const [total, rows] = await Promise.all([
      this.prisma.fleetContract.count({ where }),
      this.prisma.fleetContract.findMany({
        where,
        include: CONTRACT_INCLUDE,
        orderBy: [{ [field]: direction }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    const today = parseDay(istanbulDay(now).date)!;
    return { items: rows.map((row) => contractView(row, today)), total, page: input.page, pageSize: input.pageSize };
  }

  async get(companyId: string, rawNumber: string, now: Date = new Date()): Promise<ContractDetail> {
    const number = normalizeContractNumber(rawNumber);
    if (!number) throw fleetNotFound('Contract');
    const row = await this.prisma.fleetContract.findFirst({ where: { companyId, number }, include: CONTRACT_INCLUDE });
    if (!row) throw fleetNotFound('Contract');
    const vehicles = await this.prisma.fleetVehicle.findMany({
      where: { companyId, contractId: row.id },
      include: VEHICLE_INCLUDE,
      orderBy: [{ status: 'asc' }, { plate: 'asc' }],
    });
    return { ...contractView(row, parseDay(istanbulDay(now).date)!), vehicles: vehicles.map(vehicleView) };
  }
}
