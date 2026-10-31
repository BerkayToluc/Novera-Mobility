import 'dotenv/config';
import { ROUTE_COUNT, seedRoutes } from '../../prisma/seed-routes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CITY_CENTERS } from './simulation/stations.js';

// The sample tracking routes against a real PostgreSQL (TEST_DATABASE_URL); skipped without one (V2-43).
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('the sample tracking routes (V2-43)', () => {
  let prisma: PrismaService;
  let before: Set<string>;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    before = new Set((await prisma.trackingRoute.findMany({ select: { id: true } })).map((row) => row.id));
  });

  afterAll(async () => {
    // What this test made goes; what was there stays.
    const made = (await prisma.trackingRoute.findMany({ select: { id: true } })).map((row) => row.id).filter((id) => !before.has(id));
    await prisma.trackingRoute.deleteMany({ where: { id: { in: made } } });
    await prisma.$disconnect();
  });

  it('makes two routes for each city fleets are delivered to, and makes no copy when run again', async () => {
    expect(ROUTE_COUNT).toBe(Object.keys(CITY_CENTERS).length * 2);
    await seedRoutes(prisma);
    const again = await seedRoutes(prisma);
    expect(again.routes).toBe(0);
    for (const city of Object.keys(CITY_CENTERS)) expect(await prisma.trackingRoute.count({ where: { city } })).toBe(2);
  });

  it('a route that is not a list of at least two points is refused by the database itself', async () => {
    await expect(prisma.trackingRoute.create({ data: { city: 'Test', name: 'Bos', points: [] } })).rejects.toThrow();
    await expect(prisma.trackingRoute.create({ data: { city: 'Test', name: 'Tek', points: [{ latitude: 40, longitude: 30 }] } })).rejects.toThrow();
    await expect(prisma.trackingRoute.create({ data: { city: 'Test', name: 'Nesne', points: { latitude: 40 } } })).rejects.toThrow();
  });
});
