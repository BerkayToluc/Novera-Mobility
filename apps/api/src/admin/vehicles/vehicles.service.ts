import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { isUuid } from '../../common/uuid.js';
import { parseInput, validationFailed } from '../../common/zod-validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fold, pageOf, type Page } from '../admin-list.js';
import { inUse, staleWrite } from '../admin.errors.js';
import { createVehicleSchema, listVehicleSchema, updateVehicleSchema } from './vehicles.schemas.js';
import { plateKey, vehicleAdminView, type VehicleUsage, type VehicleView } from './vehicles.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Vehicle not found' }, HttpStatus.NOT_FOUND);

// Another car already has this plate. A 409 like a taken e-mail address, with the field named.
const plateTaken = (): HttpException =>
  new HttpException(
    { code: 'PLATE_TAKEN', message: 'A vehicle with this plate already exists', fieldErrors: { plate: 'PLATE_TAKEN' } },
    HttpStatus.CONFLICT,
  );

const include = { vehicleModel: true, branch: true } as const;

// The cars of the administration (V2-30, ADMIN.md §3.1). A fleet is a few dozen to a few hundred rows kept by hand, so a list
// reads it whole and filters, sorts and pages in memory, like the other lists. A car is never deleted: it is switched off,
// because past bookings point at it.
//
// The locks follow one order everywhere (a booking takes the car first, then the account, the code and the branches; the
// retiring of a model takes the model, then its cars): a change here takes the model for sharing, then the car, then the
// branch for sharing, so no two requests can wait for each other.
@Injectable()
export class VehiclesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: unknown): Promise<Page<VehicleView>> {
    const input = parseInput(listVehicleSchema, query, 'Vehicle list query is invalid');
    const rows = await this.prisma.vehicle.findMany({ include });
    let views = rows.map(vehicleAdminView);

    const needle = input.q ? fold(input.q) : '';
    const plateNeedle = input.q ? plateKey(input.q) : '';
    if (needle) {
      views = views.filter(
        (view) => plateKey(view.plate).includes(plateNeedle) || fold(`${view.model.brand} ${view.model.model}`).includes(needle),
      );
    }
    if (input.model) views = views.filter((view) => view.model.slug === input.model);
    if (input.branch) views = views.filter((view) => view.branch.id === input.branch);
    if (input.status) views = views.filter((view) => view.status === input.status);

    const { field: by, direction } = input.sort;
    const sign = direction === 'asc' ? 1 : -1;
    const key = (view: VehicleView): number | string =>
      by === 'model' ? fold(`${view.model.brand} ${view.model.model}`) : by === 'branch' ? fold(view.branch.name) : view[by];
    views.sort((a, b) => {
      const left = key(a);
      const right = key(b);
      return sign * (left < right ? -1 : left > right ? 1 : 0) || a.plate.localeCompare(b.plate);
    });
    return pageOf(views, input.page, input.pageSize);
  }

  // One car and what keeps it where it is, so the screen can say why it cannot be moved or switched off before the button is pressed.
  async get(id: string): Promise<VehicleView & { usage: VehicleUsage }> {
    const row = await this.find(id);
    return { ...vehicleAdminView(row), usage: await this.usageOf(this.prisma, row.id) };
  }

  // A new car goes to an open branch and a model that is on the site. The model and the branch are taken for sharing: the
  // retiring of the model and the closing of the branch take the same rows for update, so either the car is added first and they
  // see it (and refuse, or switch it off), or they come first and the car is refused here. The plate is checked by the database.
  async create(body: unknown, now: Date = new Date()): Promise<VehicleView> {
    const input = parseInput(createVehicleSchema(() => now), body, 'Vehicle validation failed');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const models = await tx.$queryRaw<Array<{ id: string; retiredAt: Date | null }>>`
          SELECT "id", "retiredAt" FROM "VehicleModel" WHERE "slug" = ${input.modelSlug} FOR SHARE`;
        const model = models[0];
        if (!model || model.retiredAt) throw validationFailed({ modelSlug: 'UNKNOWN_REFERENCE' }, 'Vehicle model not found or retired');
        const open = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Branch" WHERE "id" = ${input.branchId} AND "closedAt" IS NULL FOR SHARE`;
        if (open.length === 0) throw validationFailed({ branchId: 'UNKNOWN_REFERENCE' }, 'Branch not found or closed');

        const row = await tx.vehicle.create({
          data: { plate: input.plate, year: input.year, vehicleModelId: model.id, branchId: input.branchId },
          include,
        });
        return vehicleAdminView(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw plateTaken();
      throw error;
    }
  }

  // Moving a car to another branch, and switching it off or on. Moving and switching off are refused while a booking is still
  // to come with the car, or a hold is running on it (the refusal says how many and changes nothing). Switching a car on needs
  // a model that is on the site and a branch that is open.
  async update(id: string, body: unknown, now: Date = new Date()): Promise<VehicleView> {
    if (!isUuid(id)) throw notFound();
    const input = parseInput(updateVehicleSchema, body, 'Vehicle validation failed');

    return this.prisma.$transaction(async (tx) => {
      const peek = await tx.vehicle.findUnique({ where: { id }, select: { vehicleModelId: true } });
      if (!peek) throw notFound();
      // Switching on is the one change that depends on the model, so it takes the model first, the way the retiring of the
      // model does; the car is locked after it.
      if (input.active === true) {
        await tx.$queryRaw`SELECT "id" FROM "VehicleModel" WHERE "id" = ${peek.vehicleModelId} FOR SHARE`;
      }
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.vehicle.findUnique({ where: { id }, include });
      if (!current) throw notFound();
      if (current.updatedAt.getTime() !== input.updatedAt.getTime()) throw staleWrite();

      const moves = input.branchId !== undefined && input.branchId !== current.branchId;
      const switchesOff = input.active === false && current.active;
      const switchesOn = input.active === true && !current.active;

      if (moves || switchesOff) {
        const usage = await this.usageOf(tx, id, now);
        if (usage.reservations > 0 || usage.holds > 0) {
          throw inUse('The car still has bookings to come or a hold running; wait for them or cancel the bookings first', { ...usage });
        }
      }
      if (switchesOn && current.vehicleModel.retiredAt) {
        throw validationFailed({ active: 'NOT_ALLOWED' }, 'The model of the car is retired; put the model back first');
      }

      // The branch is taken for sharing as the last lock: the closing of a branch takes it for update (V2-27). A car that is
      // switched off may stay at a closed branch; one that is on, or is being moved, needs an open one.
      const target = input.branchId ?? current.branchId;
      const needsOpenBranch = moves || switchesOn;
      if (needsOpenBranch) {
        const open = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Branch" WHERE "id" = ${target} AND "closedAt" IS NULL FOR SHARE`;
        if (open.length === 0) {
          throw validationFailed(moves ? { branchId: 'UNKNOWN_REFERENCE' } : { active: 'NOT_ALLOWED' }, 'Branch not found or closed');
        }
      }

      const row = await tx.vehicle.update({ where: { id }, data: { branchId: input.branchId, active: input.active }, include });
      return vehicleAdminView(row);
    });
  }

  private async usageOf(db: Pick<PrismaService, 'reservation' | 'hold'>, vehicleId: string, now: Date = new Date()): Promise<VehicleUsage> {
    const [reservations, holds] = await Promise.all([
      db.reservation.count({ where: { status: 'CONFIRMED', startAt: { gt: now }, vehicleId } }),
      db.hold.count({ where: { expiresAt: { gt: now }, vehicleId } }),
    ]);
    return { reservations, holds };
  }

  private async find(id: string) {
    // The id is checked first, before the database is touched: one that cannot be an id is a car that does not exist.
    if (!isUuid(id)) throw notFound();
    const row = await this.prisma.vehicle.findUnique({ where: { id }, include });
    if (!row) throw notFound();
    return row;
  }
}
