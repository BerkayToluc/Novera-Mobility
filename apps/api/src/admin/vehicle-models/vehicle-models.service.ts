import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../../common/prisma-errors.js';
import { parseInput, validationFailed } from '../../common/zod-validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fold, pageOf, type Page } from '../admin-list.js';
import { inUse, staleWrite } from '../admin.errors.js';
import { createModelSchema, listModelSchema, SLUG, updateModelSchema } from './vehicle-models.schemas.js';
import {
  consumptionUnitOf,
  isElectric,
  modelAdminView,
  slugOf,
  type ModelUsage,
  type ModelView,
} from './vehicle-models.view.js';

const notFound = (): HttpException =>
  new HttpException({ code: 'NOT_FOUND', message: 'Vehicle model not found' }, HttpStatus.NOT_FOUND);

// Another model already has this address. A 409 like a taken e-mail address, with the field named.
const slugTaken = (): HttpException =>
  new HttpException(
    { code: 'SLUG_TAKEN', message: 'A vehicle model with this address already exists', fieldErrors: { slug: 'SLUG_TAKEN' } },
    HttpStatus.CONFLICT,
  );

type Reads = Pick<PrismaService, 'vehicle'>;

// Cars that are switched on, per model, for the whole table in one query.
async function activeVehicleCounts(db: Reads): Promise<Map<string, number>> {
  const groups = await db.vehicle.groupBy({ by: ['vehicleModelId'], where: { active: true }, _count: { _all: true } });
  return new Map(groups.map((group) => [group.vehicleModelId, group._count._all]));
}

// The vehicle models of the administration (V2-29, ADMIN.md §3.1). Like the branches, the table is small and kept by hand (a few
// dozen rows), so a list reads it whole and filters, sorts and pages in memory. A model is never deleted: it is retired and
// can be put back, because past bookings show it.
@Injectable()
export class VehicleModelsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // The classes a model can be in, for the form's choice. They are fixed (ADMIN.md §3.1: no new class is added).
  async classes(): Promise<Array<{ slug: string; name: { tr: string; en: string } }>> {
    const rows = await this.prisma.vehicleClass.findMany();
    return rows
      .map((row) => ({ slug: row.slug, name: { tr: row.nameTr, en: row.nameEn } }))
      .sort((a, b) => a.name.tr.localeCompare(b.name.tr, 'tr'));
  }

  async list(query: unknown): Promise<Page<ModelView>> {
    const input = parseInput(listModelSchema, query, 'Vehicle model list query is invalid');
    const [rows, counts] = await Promise.all([this.prisma.vehicleModel.findMany({ include: { class: true } }), activeVehicleCounts(this.prisma)]);
    let views = rows.map((row) => modelAdminView(row, counts.get(row.id) ?? 0));

    const needle = input.q ? fold(input.q) : '';
    if (needle) views = views.filter((view) => fold(`${view.brand} ${view.model} ${view.slug}`).includes(needle));
    if (input.class) views = views.filter((view) => view.class.slug === input.class);
    if (input.fuel) views = views.filter((view) => view.fuelType === input.fuel);
    if (input.status) views = views.filter((view) => view.status === input.status);

    const { field: by, direction } = input.sort;
    const sign = direction === 'asc' ? 1 : -1;
    const key = (view: ModelView): number | string => (by === 'name' ? fold(`${view.brand} ${view.model}`) : view[by]);
    views.sort((a, b) => {
      const left = key(a);
      const right = key(b);
      return sign * (left < right ? -1 : left > right ? 1 : 0) || a.slug.localeCompare(b.slug);
    });
    return pageOf(views, input.page, input.pageSize);
  }

  // One model and what keeps it on the site, so the screen can say why it cannot be retired before anyone presses the button.
  async get(rawSlug: string): Promise<ModelView & { usage: ModelUsage }> {
    const row = await this.find(rawSlug);
    const [active, usage] = await Promise.all([this.prisma.vehicle.count({ where: { vehicleModelId: row.id, active: true } }), this.usageOf(this.prisma, row.id)]);
    return { ...modelAdminView(row, active), usage };
  }

  async create(body: unknown): Promise<ModelView> {
    const input = parseInput(createModelSchema, body, 'Vehicle model validation failed');
    const vehicleClass = await this.prisma.vehicleClass.findUnique({ where: { slug: input.classSlug } });
    if (!vehicleClass) throw validationFailed({ classSlug: 'UNKNOWN_REFERENCE' }, 'Vehicle class not found');

    // The address is chosen once and never changes, so it has to be a good one: the one given, or the one the name makes.
    const slug = input.slug ?? slugOf(input.brand, input.model);
    if (slug.length < 3 || !SLUG.test(slug)) throw validationFailed({ slug: 'INVALID_FORMAT' }, 'The address of the model is not valid');

    try {
      const row = await this.prisma.vehicleModel.create({
        data: {
          slug,
          brand: input.brand,
          model: input.model,
          seats: input.seats,
          bags: input.bags,
          transmission: input.transmission,
          fuelType: input.fuelType,
          consumption: input.consumption,
          consumptionUnit: consumptionUnitOf(input.fuelType),
          dailyPrice: input.dailyPrice,
          description: input.description,
          imageUrl: input.imageUrl,
          classId: vehicleClass.id,
        },
        include: { class: true },
      });
      return modelAdminView(row, 0);
    } catch (error) {
      if (isUniqueViolation(error)) throw slugTaken();
      throw error;
    }
  }

  // The model row is locked first: two edits, or an edit and a retiring, take turns.
  async update(rawSlug: string, body: unknown): Promise<ModelView> {
    const slug = this.slugOf(rawSlug);
    const input = parseInput(updateModelSchema, body, 'Vehicle model validation failed');
    const { updatedAt, classSlug, fuelType } = input;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "VehicleModel" WHERE "slug" = ${slug} FOR UPDATE`;
      const current = await tx.vehicleModel.findUnique({ where: { slug } });
      if (!current) throw notFound();
      if (current.updatedAt.getTime() !== updatedAt.getTime()) throw staleWrite();

      let classId: string | undefined;
      if (classSlug !== undefined) {
        const vehicleClass = await tx.vehicleClass.findUnique({ where: { slug: classSlug } });
        if (!vehicleClass) throw validationFailed({ classSlug: 'UNKNOWN_REFERENCE' }, 'Vehicle class not found');
        classId = vehicleClass.id;
      }

      // Moving between an electric and another car changes what the consumption is measured in, so the old number would be
      // wrong in the new unit: it has to be given again.
      if (fuelType !== undefined && isElectric(fuelType) !== isElectric(current.fuelType) && input.consumption === undefined) {
        throw validationFailed({ consumption: 'REQUIRED' }, 'The consumption has to be given again when the fuel changes unit');
      }

      const row = await tx.vehicleModel.update({
        where: { slug },
        data: {
          brand: input.brand,
          model: input.model,
          seats: input.seats,
          bags: input.bags,
          transmission: input.transmission,
          consumption: input.consumption,
          dailyPrice: input.dailyPrice,
          description: input.description,
          imageUrl: input.imageUrl,
          classId,
          ...(fuelType !== undefined ? { fuelType, consumptionUnit: consumptionUnitOf(fuelType) } : {}),
        },
        include: { class: true },
      });
      return modelAdminView(row, await tx.vehicle.count({ where: { vehicleModelId: row.id, active: true } }));
    });
  }

  // Retiring is refused while a booking is still to come with one of the model's cars, or a hold is running on one (ADMIN.md
  // §3.1); the refusal says how many of each and changes nothing. A running rental is not counted: its car comes back and is
  // not rented again. Once it is allowed, the model and all its cars go off in the same transaction. A model that is already
  // retired stays retired (the call can be repeated).
  async retire(rawSlug: string, now: Date = new Date()): Promise<ModelView> {
    const slug = this.slugOf(rawSlug);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "VehicleModel" WHERE "slug" = ${slug} FOR UPDATE`;
      const current = await tx.vehicleModel.findUnique({ where: { slug }, include: { class: true } });
      if (!current) throw notFound();
      if (current.retiredAt) return modelAdminView(current, 0);

      // The cars are locked the way a booking and a hold lock one (always the vehicle first, in the same order for everyone),
      // so a booking that is being made on one of them finishes first and is counted, or waits and finds the car switched off.
      // The model row is not locked by them, so no two requests wait for each other.
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "vehicleModelId" = ${current.id} ORDER BY "id" FOR UPDATE`;
      const usage = await this.usageOf(tx, current.id, now);
      if (usage.reservations > 0 || usage.holds > 0) {
        throw inUse('The model still has bookings to come or holds running; wait for them or cancel the bookings first', { ...usage });
      }
      await tx.vehicle.updateMany({ where: { vehicleModelId: current.id, active: true }, data: { active: false } });
      const row = await tx.vehicleModel.update({ where: { slug }, data: { retiredAt: now }, include: { class: true } });
      return modelAdminView(row, 0);
    });
  }

  // Putting a model back brings it onto the site as it was. Its cars stay switched off: which of them are in use again is for
  // the person to say, car by car (V2-30); nothing here can know.
  async restore(rawSlug: string): Promise<ModelView> {
    const slug = this.slugOf(rawSlug);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "VehicleModel" WHERE "slug" = ${slug} FOR UPDATE`;
      const current = await tx.vehicleModel.findUnique({ where: { slug }, include: { class: true } });
      if (!current) throw notFound();
      const row = current.retiredAt
        ? await tx.vehicleModel.update({ where: { slug }, data: { retiredAt: null }, include: { class: true } })
        : current;
      return modelAdminView(row, await tx.vehicle.count({ where: { vehicleModelId: row.id, active: true } }));
    });
  }

  private async usageOf(db: Pick<PrismaService, 'reservation' | 'hold'>, modelId: string, now: Date = new Date()): Promise<ModelUsage> {
    const [reservations, holds] = await Promise.all([
      db.reservation.count({ where: { status: 'CONFIRMED', startAt: { gt: now }, vehicle: { vehicleModelId: modelId } } }),
      db.hold.count({ where: { expiresAt: { gt: now }, vehicle: { vehicleModelId: modelId } } }),
    ]);
    return { reservations, holds };
  }

  // An address in the path, as it is stored: lower case. Something that cannot be an address is a model that does not exist.
  private slugOf(raw: string): string {
    const slug = raw.toLowerCase();
    if (!SLUG.test(slug)) throw notFound();
    return slug;
  }

  private async find(rawSlug: string) {
    // The address is checked first, before the database is touched: one that cannot be an address is a model that does not exist.
    const slug = this.slugOf(rawSlug);
    const row = await this.prisma.vehicleModel.findUnique({ where: { slug }, include: { class: true } });
    if (!row) throw notFound();
    return row;
  }
}
