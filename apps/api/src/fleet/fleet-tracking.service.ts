import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { normalizePlate } from '../admin/vehicles/vehicles.view.js';
import { istanbulDay, istanbulDateStart } from '../common/time.js';
import { field } from '../common/zod-fields.js';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { addDays, dayOf, parseDay } from './fleet-dates.js';
import { fleetNotFound } from './fleet.errors.js';
import { chooseRoute, isShiftSlot, slotOf, trackDay, type RoutePoint } from './simulation/tracking.js';
import { SLICE_MS, sliceOf, sliceStart } from './simulation/slice.js';

// How many days back a route can be asked for: today and the six before it (docs/FLEET.md §4.1).
export const ROUTE_DAYS = 7;

const routeQuerySchema = z.object({
  date: field<string | null>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    return typeof raw === 'string' && parseDay(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
  }),
});

export type TrackedVehicle = {
  plate: string;
  model: string;
  city: string;
  // Whoever has the car now, by name; null when nobody has.
  employee: { id: string; name: string } | null;
  ignition: boolean;
  speedKmh: number;
  // Null when there is no route in the city of the car: it is listed, but not on a map.
  position: { latitude: number; longitude: number } | null;
};
export type TrackingList = {
  // Everything in this answer about where the cars are is made up (ADR-30).
  simulated: true;
  // The five minutes the positions are for.
  updatedAt: string;
  items: TrackedVehicle[];
};
export type RouteDay = {
  simulated: true;
  vehicle: { plate: string; city: string; route: string | null };
  date: string;
  // Every five minutes of the day up to now; empty when the city has no route.
  points: Array<{ at: string; latitude: number; longitude: number; speedKmh: number; ignition: boolean }>;
};

// The live tracking of the signed-in company's cars (V2-43, docs/FLEET.md §3, §3.1): a simulation (ADR-30) worked out from the car, the
// routes of its city and the five minutes, never stored. Every query takes the company first (ADR-25); a car that was given back is not on
// the road, so it is not here and its route is a 404 like one that does not exist.
@Injectable()
export class FleetTrackingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async routesOf(cities: string[]): Promise<Map<string, Array<{ name: string; points: RoutePoint[] }>>> {
    const rows = cities.length === 0 ? [] : await this.prisma.trackingRoute.findMany({ where: { city: { in: cities } }, select: { city: true, name: true, points: true } });
    const byCity = new Map<string, Array<{ name: string; points: RoutePoint[] }>>();
    for (const row of rows) byCity.set(row.city, [...(byCity.get(row.city) ?? []), { name: row.name, points: row.points as RoutePoint[] }]);
    return byCity;
  }

  async tracking(companyId: string, now: Date = new Date()): Promise<TrackingList> {
    const cars = await this.prisma.fleetVehicle.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { plate: 'asc' },
      select: {
        id: true,
        plate: true,
        vehicleModel: { select: { brand: true, model: true } },
        contract: { select: { deliveryCity: true } },
        assignments: { where: { endedAt: null }, take: 1, select: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    const routes = await this.routesOf([...new Set(cars.map((car) => car.contract.deliveryCity))]);
    const date = istanbulDay(now).date;
    const slot = slotOf(now, date);

    const items = cars.map((car): TrackedVehicle => {
      const city = car.contract.deliveryCity;
      const route = chooseRoute(car.id, routes.get(city) ?? []);
      const owner = car.assignments[0]?.employee;
      const base = { plate: car.plate, model: `${car.vehicleModel.brand} ${car.vehicleModel.model}`, city, employee: owner ? { id: owner.id, name: `${owner.firstName} ${owner.lastName}` } : null };
      if (!route) return { ...base, ignition: isShiftSlot(date, slot), speedKmh: 0, position: null };
      const sample = trackDay(car.id, route.points, date)[slot]!;
      return { ...base, ignition: sample.ignition, speedKmh: sample.speedKmh, position: { latitude: sample.latitude, longitude: sample.longitude } };
    });
    return { simulated: true, updatedAt: sliceStart(sliceOf(now)).toISOString(), items };
  }

  // The route of a car on a day: every five minutes from midnight to now (the whole day for a day that is over). Today and the six days
  // before it; a later day, or an earlier one, is `OUT_OF_RANGE`.
  async route(companyId: string, rawPlate: string, query: unknown, now: Date = new Date()): Promise<RouteDay> {
    const plate = normalizePlate(rawPlate);
    if (!plate) throw fleetNotFound('Vehicle');
    const input = parseInput(routeQuerySchema, query, 'Route query is invalid');
    const today = istanbulDay(now).date;
    const date = input.date ?? today;
    const oldest = dayOf(addDays(parseDay(today)!, -(ROUTE_DAYS - 1)))!;
    if (date > today || date < oldest) {
      throw validationFailed({ date: 'OUT_OF_RANGE' }, `A route can be asked for ${oldest} to ${today}`);
    }

    const car = await this.prisma.fleetVehicle.findFirst({ where: { companyId, plate, status: 'ACTIVE' }, select: { id: true, plate: true, contract: { select: { deliveryCity: true } } } });
    if (!car) throw fleetNotFound('Vehicle');
    const city = car.contract.deliveryCity;
    const route = chooseRoute(car.id, (await this.routesOf([city])).get(city) ?? []);
    if (!route) return { simulated: true, vehicle: { plate: car.plate, city, route: null }, date, points: [] };

    const midnight = istanbulDateStart(date).getTime();
    const last = date === today ? slotOf(now, date) : 287;
    const points = trackDay(car.id, route.points, date)
      .slice(0, last + 1)
      .map((sample) => ({ at: new Date(midnight + sample.slot * SLICE_MS).toISOString(), latitude: sample.latitude, longitude: sample.longitude, speedKmh: sample.speedKmh, ignition: sample.ignition }));
    return { simulated: true, vehicle: { plate: car.plate, city, route: route.name }, date, points };
  }
}
