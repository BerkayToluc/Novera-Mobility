import { Inject, Injectable } from '@nestjs/common';
import { QuotesService, type QuoteReceived } from '../forms/quotes.service.js';
import type { UserRow } from '../auth/user-view.js';
import type { Page } from '../admin/admin-list.js';
import { istanbulDay } from '../common/time.js';
import { parseInput } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { daysBetween, parseDay } from './fleet-dates.js';
import { fleetNotFound, renewalAlreadyRequested } from './fleet.errors.js';
import { listFleetContractSchema, renewalRequestSchema } from './fleet.schemas.js';
import { contractView, CONTRACT_INCLUDE, normalizeContractNumber, vehicleView, VEHICLE_INCLUDE, type ContractDetail, type ContractView } from './fleet.view.js';

// The contracts of the signed-in company (V2-35, docs/FLEET.md §4.1). A company without a contract gets an empty list, not an error.
@Injectable()
export class FleetContractsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuotesService) private readonly quotes: QuotesService,
  ) {}

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

  // "Yenileme talebi gönder" (V2-38, docs/FLEET.md §3): a quote request is opened for the contract, with the product and the number of cars
  // it already has (or what the customer says instead), so the sales team sees it in the quote list of the administration marked as a
  // renewal. A contract that has a renewal request in progress is not asked for again (`409 ALREADY_REQUESTED`).
  async requestRenewal(user: UserRow, companyId: string, rawNumber: string, body: unknown): Promise<QuoteReceived> {
    const number = normalizeContractNumber(rawNumber);
    if (!number) throw fleetNotFound('Contract');
    const input = parseInput(renewalRequestSchema, body, 'Renewal request validation failed');
    const contract = await this.prisma.fleetContract.findFirst({
      where: { companyId, number },
      include: { company: { select: { name: true, phone: true } }, product: { select: { id: true, slug: true } } },
    });
    if (!contract) throw fleetNotFound('Contract');

    // The line that links the request to the contract. The quote has no column for it; the number is in the first line of the notes.
    const marker = `Renewal of contract ${contract.number}`;
    const waiting = await this.prisma.quoteRequest.count({
      where: { source: 'FLEET_RENEWAL', status: { not: 'CLOSED' }, notes: { startsWith: marker }, user: { is: { companyId } } },
    });
    if (waiting > 0) throw renewalAlreadyRequested();

    const cars = await this.prisma.fleetVehicle.findMany({
      where: { contractId: contract.id, status: 'ACTIVE' },
      select: { vehicleModel: { select: { brand: true, model: true } } },
    });
    const models = [...new Set(cars.map((car) => `${car.vehicleModel.brand} ${car.vehicleModel.model}`))].join(', ');
    const months = Math.max(1, Math.round(daysBetween(contract.startAt, contract.endAt) / 30.4375));
    return this.quotes.createFleetRenewal({
      companyName: contract.company.name,
      contactName: `${user.firstName} ${user.lastName}`.trim(),
      phone: contract.company.phone,
      email: user.email,
      vehicleCount: input.vehicleCount ?? Math.max(1, cars.length),
      durationMonths: input.durationMonths ?? Math.min(120, months),
      vehicleType: (models || contract.product.slug).slice(0, 200),
      notes: input.notes ? `${marker}\n${input.notes}` : marker,
      productId: contract.product.id,
      userId: user.id,
    });
  }
}
