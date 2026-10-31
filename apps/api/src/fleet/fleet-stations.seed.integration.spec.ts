import 'dotenv/config';
import { seedStations, STATION_COUNT } from '../../prisma/seed-stations.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CITY_CENTERS, distanceKm } from './simulation/stations.js';

// The sample charging stations against a real PostgreSQL (TEST_DATABASE_URL); skipped without one (V2-40).
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('the sample charging stations (V2-40)', () => {
  let prisma: PrismaService;
  let before: Set<string>;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    before = new Set((await prisma.chargingStation.findMany({ select: { id: true } })).map((row) => row.id));
  });

  afterAll(async () => {
    // What this test made goes; what was there stays.
    const made = (await prisma.chargingStation.findMany({ select: { id: true } })).map((row) => row.id).filter((id) => !before.has(id));
    await prisma.chargingStation.deleteMany({ where: { id: { in: made } } });
    await prisma.$disconnect();
  });

  it('makes about thirty stations in the cities fleets are delivered to, and makes no copy when run again', async () => {
    expect(STATION_COUNT).toBeGreaterThanOrEqual(28);
    expect(STATION_COUNT).toBeLessThanOrEqual(32);
    await seedStations(prisma);
    const again = await seedStations(prisma);
    expect(again.stations).toBe(0);
    const rows = await prisma.chargingStation.findMany();
    expect(rows.length).toBeGreaterThanOrEqual(STATION_COUNT);
    const names = rows.map((row) => `${row.city}|${row.name}`);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every station is near the centre of its city, has at least one socket, and the two cities of the sample companies have some', async () => {
    await seedStations(prisma);
    const rows = await prisma.chargingStation.findMany({ where: { city: { in: Object.keys(CITY_CENTERS) } } });
    for (const row of rows) {
      expect(distanceKm(CITY_CENTERS[row.city]!, row)).toBeLessThan(40);
      expect(row.sockets.length).toBeGreaterThanOrEqual(1);
    }
    for (const city of ['İzmir', 'Ankara']) expect(rows.filter((row) => row.city === city).length).toBeGreaterThanOrEqual(5);
  });

  it('a station with no socket, or off the globe, is refused by the database itself', async () => {
    await expect(prisma.chargingStation.create({ data: { name: 'Bos', city: 'Test', latitude: 40, longitude: 30, sockets: [] } })).rejects.toThrow();
    await expect(prisma.chargingStation.create({ data: { name: 'Uzay', city: 'Test', latitude: 140, longitude: 30, sockets: ['CCS'] } })).rejects.toThrow();
  });
});
