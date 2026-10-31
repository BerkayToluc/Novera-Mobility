import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { istanbulDay, MINUTE_MS } from '../../common/time.js';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { isUuid } from '../../common/uuid.js';
import { parseInput, validationFailed } from '../../common/zod-validation.js';
import { parseDay } from '../../fleet/fleet-dates.js';
import { contractView, CONTRACT_INCLUDE, normalizeContractNumber, readingView, vehicleView, VEHICLE_INCLUDE, type ContractDetail, type ContractView, type FleetVehicleView, type ReadingView } from '../../fleet/fleet.view.js';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inUse, invalidTransition, staleWrite } from '../admin.errors.js';
import { createContractSchema, createFleetVehicleSchema, createReadingSchema, updateContractSchema, updateFleetVehicleSchema } from './contracts.schemas.js';

const notFound = (what: string): HttpException => new HttpException({ code: 'NOT_FOUND', message: `${what} not found` }, HttpStatus.NOT_FOUND);

// Another car, rented or of a fleet, already has this plate. A 409 like a taken e-mail address, with the field named.
const plateTaken = (): HttpException =>
  new HttpException({ code: 'PLATE_TAKEN', message: 'A vehicle with this plate already exists', fieldErrors: { plate: 'PLATE_TAKEN' } }, HttpStatus.CONFLICT);

// How far ahead of the clock a reading may be: a minute, for the clocks of two computers that do not agree.
const CLOCK_SLACK_MS = MINUTE_MS;

// The contracts and fleet cars of the administration (V2-35, docs/FLEET.md §4.2): what Novera enters for a company. Money is TRY kuruş.
// A car is never deleted: it is given back (`RETURNED`), because its history (assignments, readings) belongs to the company.
@Injectable()
export class AdminContractsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private today(now: Date): Date {
    return parseDay(istanbulDay(now).date)!;
  }

  // The contracts of one company, the one that ends first on top: a company has a handful, so there is no paging.
  async listForCompany(companyId: string, now: Date = new Date()): Promise<{ items: ContractView[] }> {
    if (!isUuid(companyId)) throw notFound('Company');
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw notFound('Company');
    const rows = await this.prisma.fleetContract.findMany({ where: { companyId }, include: CONTRACT_INCLUDE, orderBy: [{ status: 'asc' }, { endAt: 'asc' }, { id: 'asc' }] });
    const today = this.today(now);
    return { items: rows.map((row) => contractView(row, today)) };
  }

  // The number comes from a sequence, so two contracts made at the same moment never meet on one number and nothing is retried. A
  // transaction that does not commit leaves a gap in the numbers; that is fine.
  async create(companyId: string, body: unknown, now: Date = new Date()): Promise<ContractView> {
    if (!isUuid(companyId)) throw notFound('Company');
    const input = parseInput(createContractSchema, body, 'Contract validation failed');
    if (input.endAt.getTime() <= input.startAt.getTime()) throw validationFailed({ endAt: 'INVALID_DATE_RANGE' }, 'The contract has to end after it starts');

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) throw notFound('Company');
      const product = await tx.product.findUnique({ where: { slug: input.productSlug }, select: { id: true } });
      if (!product) throw validationFailed({ productSlug: 'UNKNOWN_REFERENCE' }, 'No such product');

      const [{ serial }] = await tx.$queryRaw<{ serial: bigint }[]>`SELECT nextval('"FleetContractNumber_seq"') AS serial`;
      const number = `SZL-${istanbulDay(now).date.slice(0, 4)}-${String(serial).padStart(5, '0')}`;
      const row = await tx.fleetContract.create({
        data: { number, companyId, productId: product.id, startAt: input.startAt, endAt: input.endAt, monthlyFee: input.monthlyFee, deliveryCity: input.deliveryCity },
        include: CONTRACT_INCLUDE,
      });
      return contractView(row, this.today(now));
    });
  }

  async get(rawNumber: string, now: Date = new Date()): Promise<ContractDetail> {
    const number = this.numberOf(rawNumber);
    const row = await this.prisma.fleetContract.findUnique({ where: { number }, include: CONTRACT_INCLUDE });
    if (!row) throw notFound('Contract');
    const vehicles = await this.prisma.fleetVehicle.findMany({ where: { contractId: row.id }, include: VEHICLE_INCLUDE, orderBy: [{ status: 'asc' }, { plate: 'asc' }] });
    return { ...contractView(row, this.today(now)), vehicles: vehicles.map(vehicleView) };
  }

  // The end day, the fee, the delivery city and the state. The row is locked, so two edits take turns and the second is refused
  // (`409 STALE_WRITE`). A contract is ended only after its cars are given back (`409 IN_USE`, with how many).
  async update(rawNumber: string, body: unknown, now: Date = new Date()): Promise<ContractView> {
    const number = this.numberOf(rawNumber);
    const input = parseInput(updateContractSchema, body, 'Contract validation failed');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FleetContract" WHERE "number" = ${number} FOR UPDATE`;
      const current = await tx.fleetContract.findUnique({ where: { number }, include: CONTRACT_INCLUDE });
      if (!current) throw notFound('Contract');
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();

      const endAt = input.endAt ?? current.endAt;
      if (endAt.getTime() <= current.startAt.getTime()) throw validationFailed({ endAt: 'INVALID_DATE_RANGE' }, 'The contract has to end after it starts');
      if (input.status === 'ENDED' && current.status === 'ACTIVE' && current._count.vehicles > 0) {
        throw inUse('The contract still has cars; give them back first', { vehicles: current._count.vehicles });
      }
      const { updatedAt: _version, ...changes } = input;
      void _version;
      const row = await tx.fleetContract.update({ where: { number }, data: changes, include: CONTRACT_INCLUDE });
      return contractView(row, this.today(now));
    });
  }

  // ---------- Fleet vehicles ----------
  async createVehicle(rawNumber: string, body: unknown): Promise<FleetVehicleView> {
    const number = this.numberOf(rawNumber);
    const input = parseInput(createFleetVehicleSchema, body, 'Fleet vehicle validation failed');

    try {
      return await this.prisma.$transaction(async (tx) => {
        // The contract is locked, so a car cannot be added to one that is being ended at the same moment.
        await tx.$queryRaw`SELECT "id" FROM "FleetContract" WHERE "number" = ${number} FOR UPDATE`;
        const contract = await tx.fleetContract.findUnique({ where: { number }, select: { id: true, companyId: true, status: true } });
        if (!contract) throw notFound('Contract');
        if (contract.status !== 'ACTIVE') throw invalidTransition('The contract has ended; no car can be added to it');
        const model = await tx.vehicleModel.findUnique({ where: { slug: input.modelSlug }, select: { id: true } });
        if (!model) throw validationFailed({ modelSlug: 'UNKNOWN_REFERENCE' }, 'No such vehicle model');

        // A plate is one car, whether it is rented out or in a fleet (ADR-25): the other table is asked here.
        const rented = await tx.vehicle.findUnique({ where: { plate: input.plate }, select: { id: true } });
        if (rented) throw plateTaken();
        const row = await tx.fleetVehicle.create({
          data: {
            contractId: contract.id,
            companyId: contract.companyId,
            vehicleModelId: model.id,
            plate: input.plate,
            year: input.year,
            startKm: input.startKm,
            nextMaintenanceOn: input.nextMaintenanceOn,
            inspectionDueOn: input.inspectionDueOn,
          },
          include: VEHICLE_INCLUDE,
        });
        return vehicleView(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw plateTaken();
      throw error;
    }
  }

  // The maintenance and inspection days, and giving the car back (`returned: true`): the car is not deleted, it leaves the fleet in use,
  // and the assignment it has is ended now. A car that has been given back is history and is not changed.
  async updateVehicle(id: string, body: unknown, now: Date = new Date()): Promise<FleetVehicleView> {
    if (!isUuid(id)) throw notFound('Fleet vehicle');
    const input = parseInput(updateFleetVehicleSchema, body, 'Fleet vehicle validation failed');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FleetVehicle" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.fleetVehicle.findUnique({ where: { id }, include: VEHICLE_INCLUDE });
      if (!current) throw notFound('Fleet vehicle');
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();
      if (current.status === 'RETURNED') throw invalidTransition('The car has been given back; it is not changed');

      if (input.returned) {
        await tx.vehicleAssignment.updateMany({ where: { fleetVehicleId: id, endedAt: null }, data: { endedAt: now } });
      }
      const row = await tx.fleetVehicle.update({
        where: { id },
        data: {
          nextMaintenanceOn: input.nextMaintenanceOn,
          inspectionDueOn: input.inspectionDueOn,
          ...(input.returned ? { status: 'RETURNED' as const, returnedAt: now } : {}),
        },
        include: VEHICLE_INCLUDE,
      });
      return vehicleView(row);
    });
  }

  // A reading: the kilometre, and the fuel, charge and battery health where they apply. The kilometre does not go back, and a
  // reading is not older than the last one: a number that does is refused (`422`) instead of leaving the car with two stories.
  async addReading(id: string, body: unknown, now: Date = new Date()): Promise<ReadingView> {
    if (!isUuid(id)) throw notFound('Fleet vehicle');
    const input = parseInput(createReadingSchema, body, 'Reading validation failed');
    const at = input.at ?? now;
    if (at.getTime() > now.getTime() + CLOCK_SLACK_MS) throw validationFailed({ at: 'OUT_OF_RANGE' }, 'A reading is not from the future');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FleetVehicle" WHERE "id" = ${id} FOR UPDATE`;
      const vehicle = await tx.fleetVehicle.findUnique({ where: { id }, select: { id: true, status: true, startKm: true } });
      if (!vehicle) throw notFound('Fleet vehicle');
      if (vehicle.status !== 'ACTIVE') throw invalidTransition('The car has been given back; no reading is taken');

      const last = await tx.vehicleReading.findFirst({ where: { fleetVehicleId: id }, orderBy: [{ at: 'desc' }, { id: 'asc' }], select: { km: true, at: true } });
      if (input.km < (last?.km ?? vehicle.startKm)) throw validationFailed({ km: 'OUT_OF_RANGE' }, 'The kilometre is lower than the last one');
      if (last && at.getTime() < last.at.getTime()) throw validationFailed({ at: 'OUT_OF_RANGE' }, 'The reading is older than the last one');

      const row = await tx.vehicleReading.create({
        data: { fleetVehicleId: id, at, km: input.km, fuelPercent: input.fuelPercent, chargePercent: input.chargePercent, batteryHealthPercent: input.batteryHealthPercent },
      });
      return readingView(row);
    });
  }

  // A number in the path, as it is stored: capitals. Something that cannot be a number is a contract that does not exist.
  private numberOf(raw: string): string {
    const number = normalizeContractNumber(raw);
    if (!number) throw notFound('Contract');
    return number;
  }
}
