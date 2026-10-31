import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { normalizePlate } from '../admin/vehicles/vehicles.view.js';
import { istanbulDay } from '../common/time.js';
import { field } from '../common/zod-fields.js';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { carbonSavedGrams, EMISSION_G_PER_KM, isGreenFuel, PETROL_G_PER_KM, type GreenFuel } from './fleet-report.js';
import { fleetNotFound } from './fleet.errors.js';
import { isMonth, kmAt, monthsBetween, monthStart, nextMonth, MAX_REPORT_MONTHS } from './report-calc.js';
import { distanceKm, CITY_CENTERS, stationStatus, type StationStatus } from './simulation/stations.js';
import { sliceOf, sliceStart } from './simulation/slice.js';

const DAY = 86_400_000;
// How far back the battery's health is followed on the screen (docs/FLEET.md §3): the readings of the last six months.
const TREND_DAYS = 183;
export const DEFAULT_STATIONS = 5;
export const MAX_STATIONS = 20;

const monthQuery = field<string | null>((raw) => {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  return typeof raw === 'string' && isMonth(raw) ? { value: raw } : { code: 'INVALID_FORMAT' };
});
const greenQuerySchema = z.object({ from: monthQuery, to: monthQuery });
const stationsQuerySchema = z.object({
  limit: field<number>((raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: DEFAULT_STATIONS };
    if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw)) return { code: 'INVALID_FORMAT' };
    const value = Number(raw);
    return value < 1 || value > MAX_STATIONS ? { code: 'OUT_OF_RANGE' } : { value };
  }),
});

export type GreenVehicle = {
  id: string;
  plate: string;
  model: string;
  fuel: GreenFuel;
  // The latest charge anybody wrote down, and when; null when none was (a hybrid that is not charged from the grid, for one).
  charge: { percent: number; at: string } | null;
  // The latest battery health, and the readings of the last six months it comes from, oldest first.
  batteryHealth: { percent: number; at: string } | null;
  batteryTrend: Array<{ at: string; percent: number }>;
  km: number;
  savedGrams: number;
};

export type GreenReport = {
  from: string;
  to: string;
  vehicles: GreenVehicle[];
  totals: { km: number; savedGrams: number };
  // Grams of CO₂ per kilometre: what a petrol car gives off, and each kind of green car (docs/FLEET.md §3.1). The screen says it is an example.
  coefficients: { petrol: number; hybrid: number; electric: number };
};

export type StationView = { id: string; name: string; city: string; latitude: number; longitude: number; sockets: string[]; distanceKm: number | null; status: StationStatus };
export type StationList = {
  // Everything in this answer about the stations' state, and the position of the car, is made up (ADR-30).
  simulated: true;
  vehicle: { plate: string; city: string; position: { latitude: number; longitude: number } | null };
  // The five minutes the states are for.
  updatedAt: string;
  items: StationView[];
};

// The Green Fleet screen's data (V2-40, docs/FLEET.md §3, §3.1): the electric and hybrid cars of the signed-in company, their charge and
// battery, the carbon they saved, and the charging stations nearest to one of them. Every query takes the company first (ADR-25).
@Injectable()
export class FleetGreenService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async green(companyId: string, query: unknown, now: Date = new Date()): Promise<GreenReport> {
    const input = parseInput(greenQuerySchema, query, 'Green fleet query is invalid');
    const thisMonth = istanbulDay(now).date.slice(0, 7);
    const to = input.to ?? thisMonth;
    // The last three months, the way the report starts.
    const from = input.from ?? (input.to ? input.to : monthsBackFrom(to, 2));
    if (to > thisMonth) throw validationFailed({ to: 'OUT_OF_RANGE' }, 'A month that has not started has no figures');
    if (from > to) throw validationFailed({ from: 'OUT_OF_RANGE' }, 'The first month is after the last');
    if (monthsBetween(from, to).length > MAX_REPORT_MONTHS) throw validationFailed({ from: 'OUT_OF_RANGE' }, `A period covers at most ${MAX_REPORT_MONTHS} months`);

    const start = new Date(monthStart(from).getTime() - 1);
    const end = new Date(Math.min(monthStart(nextMonth(to)).getTime() - 1, now.getTime()));
    const rows = await this.prisma.fleetVehicle.findMany({
      where: { companyId, status: 'ACTIVE', vehicleModel: { fuelType: { in: ['ELECTRIC', 'HYBRID'] } } },
      orderBy: { plate: 'asc' },
      select: {
        id: true,
        plate: true,
        startKm: true,
        vehicleModel: { select: { brand: true, model: true, fuelType: true } },
        readings: { where: { at: { lte: now } }, orderBy: [{ at: 'asc' }, { id: 'asc' }], select: { at: true, km: true, chargePercent: true, batteryHealthPercent: true } },
      },
    });

    const since = now.getTime() - TREND_DAYS * DAY;
    const vehicles = rows.flatMap((row): GreenVehicle[] => {
      const fuel = row.vehicleModel.fuelType;
      if (!isGreenFuel(fuel)) return [];
      const charged = row.readings.filter((reading) => reading.chargePercent !== null);
      const health = row.readings.filter((reading) => reading.batteryHealthPercent !== null);
      const lastCharge = charged.at(-1);
      const lastHealth = health.at(-1);
      const km = Math.max(0, kmAt(row, end) - kmAt(row, start));
      return [
        {
          id: row.id,
          plate: row.plate,
          model: `${row.vehicleModel.brand} ${row.vehicleModel.model}`,
          fuel,
          charge: lastCharge ? { percent: lastCharge.chargePercent!, at: lastCharge.at.toISOString() } : null,
          batteryHealth: lastHealth ? { percent: lastHealth.batteryHealthPercent!, at: lastHealth.at.toISOString() } : null,
          batteryTrend: health.filter((reading) => reading.at.getTime() >= since).map((reading) => ({ at: reading.at.toISOString(), percent: reading.batteryHealthPercent! })),
          km,
          savedGrams: carbonSavedGrams(fuel, km),
        },
      ];
    });
    return {
      from,
      to,
      vehicles,
      totals: { km: vehicles.reduce((sum, v) => sum + v.km, 0), savedGrams: vehicles.reduce((sum, v) => sum + v.savedGrams, 0) },
      coefficients: { petrol: PETROL_G_PER_KM, hybrid: EMISSION_G_PER_KM.HYBRID, electric: EMISSION_G_PER_KM.ELECTRIC },
    };
  }

  // The charging stations nearest to a car, with the state each one is in during these five minutes. Until the car has a live position
  // (V2-43) it is taken to be in the centre of the city its contract is delivered to; a city with no known centre gets the stations without
  // distances, those of its own city first. A car that is not electric or hybrid has nothing to charge, and one that was given back is not on the road: the same 404 as one that is not there.
  async stations(companyId: string, rawPlate: string, query: unknown, now: Date = new Date()): Promise<StationList> {
    const plate = normalizePlate(rawPlate);
    if (!plate) throw fleetNotFound('Vehicle');
    const { limit } = parseInput(stationsQuerySchema, query, 'Station query is invalid');
    const car = await this.prisma.fleetVehicle.findFirst({
      where: { companyId, plate, status: 'ACTIVE' },
      select: { plate: true, contract: { select: { deliveryCity: true } }, vehicleModel: { select: { fuelType: true } } },
    });
    if (!car || !isGreenFuel(car.vehicleModel.fuelType)) throw fleetNotFound('Vehicle');

    const city = car.contract.deliveryCity;
    const position = CITY_CENTERS[city] ?? null;
    const slice = sliceOf(now);
    const stations = await this.prisma.chargingStation.findMany({ orderBy: [{ city: 'asc' }, { name: 'asc' }] });
    const items = stations
      .map((station): StationView => ({
        id: station.id,
        name: station.name,
        city: station.city,
        latitude: station.latitude,
        longitude: station.longitude,
        sockets: station.sockets,
        distanceKm: position ? distanceKm(position, station) : null,
        status: stationStatus(station.id, slice),
      }))
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'tr');
        // Without a position, the car's own city comes first.
        return Number(b.city === city) - Number(a.city === city) || a.city.localeCompare(b.city, 'tr') || a.name.localeCompare(b.name, 'tr');
      })
      .slice(0, limit);
    return { simulated: true, vehicle: { plate: car.plate, city, position }, updatedAt: sliceStart(slice).toISOString(), items };
  }
}

function monthsBackFrom(month: string, count: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, m - 1 - count, 1)).toISOString().slice(0, 7);
}
