import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { FLEET_SEEDS, seedFleet } from '../../prisma/seed-fleet.js';

// The sample fleet customers of the seed (V2-35, docs/FLEET.md §5) against a real PostgreSQL (TEST_DATABASE_URL); skipped without one.
// The seed runs on a live database too, so it must make no copy when it runs again and must not put the sample back over what a
// person changed. The companies and cars of the sample are the seed's own names, so this test cleans them up when it is done.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('the fleet seed against the database (V2-35)', () => {
  let prisma: PrismaService;
  const run = randomUUID().slice(0, 8);
  const created = { products: [] as string[], models: [] as string[], classes: [] as string[] };
  const names = FLEET_SEEDS.map((seed) => seed.name);
  const emails = FLEET_SEEDS.map((seed) => seed.user.email);
  const plates = FLEET_SEEDS.flatMap((seed) => seed.contracts.flatMap((contract) => contract.cars.map((car) => car.plate)));

  async function clean() {
    const companies = await prisma.company.findMany({ where: { name: { in: names } }, select: { id: true } });
    const companyIds = companies.map((row) => row.id);
    const cars = await prisma.fleetVehicle.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    await prisma.vehicleReading.deleteMany({ where: { fleetVehicleId: { in: cars.map((row) => row.id) } } });
    await prisma.vehicleAssignment.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.companyEmployee.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    await clean();

    // What the main seed has made on a real database: the products and the models the sample uses. A test database may not have them.
    const wanted = new Set(FLEET_SEEDS.flatMap((seed) => seed.contracts.flatMap((contract) => [contract.productSlug, ...contract.cars.map((car) => `model:${car.modelSlug}`)])));
    const classId = (await prisma.vehicleClass.create({ data: { slug: `v35s-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    created.classes.push(classId);
    for (const entry of wanted) {
      if (entry.startsWith('model:')) {
        const slug = entry.slice('model:'.length);
        if (await prisma.vehicleModel.findUnique({ where: { slug } })) continue;
        const model = await prisma.vehicleModel.create({
          data: { slug, brand: 'Test', model: slug, seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: 'PETROL', consumption: 5, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'T', en: 'T' }, classId },
        });
        created.models.push(model.id);
      } else if (!(await prisma.product.findUnique({ where: { slug: entry } }))) {
        created.products.push((await prisma.product.create({ data: { slug: entry } })).id);
      }
    }
  });

  afterAll(async () => {
    await clean();
    await prisma.vehicleModel.deleteMany({ where: { id: { in: created.models } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.vehicleClass.deleteMany({ where: { id: { in: created.classes } } });
    await prisma.$disconnect();
  });

  const counts = async () => {
    const companyIds = (await prisma.company.findMany({ where: { name: { in: names } }, select: { id: true } })).map((row) => row.id);
    return {
    companies: await prisma.company.count({ where: { name: { in: names } } }),
    users: await prisma.user.count({ where: { email: { in: emails } } }),
    contracts: await prisma.fleetContract.count({ where: { company: { name: { in: names } } } }),
    cars: await prisma.fleetVehicle.count({ where: { plate: { in: plates } } }),
    people: await prisma.companyEmployee.count({ where: { company: { name: { in: names } } } }),
    assignments: await prisma.vehicleAssignment.count({ where: { companyId: { in: companyIds } } }),
    readings: await prisma.vehicleReading.count({ where: { vehicle: { plate: { in: plates } } } }),
    };
  };

  it('makes two companies with their contracts, twelve cars, fifteen people, some assignments and three readings a car', async () => {
    const added = await seedFleet(prisma, { password: 'ornek-seed-parolasi-1' });
    expect(added).toMatchObject({ companies: 2, users: 2, contracts: 3, cars: 12, people: 15, assignments: 8, readings: 36 });
    expect(await counts()).toEqual({ companies: 2, users: 2, contracts: 3, cars: 12, people: 15, assignments: 8, readings: 36 });

    // The user belongs to the company and has no password in the clear; the contracts carry the sample's products.
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0]! }, include: { company: true } });
    expect(user).toMatchObject({ accountType: 'CORPORATE', company: { name: names[0] } });
    expect(user.passwordHash).not.toContain('ornek-seed-parolasi-1');
    const green = await prisma.fleetContract.findMany({ where: { company: { name: names[1]! } }, include: { product: true }, orderBy: { startAt: 'asc' } });
    expect(green.map((row) => row.product.slug)).toEqual(['yesil-filo', 'vip-mobilite']);
    const unassigned = await prisma.fleetVehicle.count({ where: { plate: { in: plates }, assignments: { none: {} } } });
    expect(unassigned).toBe(4);
  });

  it('run again, it makes no copy and adds nothing', async () => {
    const before = await counts();
    const again = await seedFleet(prisma, { password: 'ornek-seed-parolasi-1' });
    expect(again).toEqual({ companies: 0, users: 0, contracts: 0, cars: 0, people: 0, assignments: 0, readings: 0 });
    expect(await counts()).toEqual(before);
  });

  it('does not put the sample back over what a person changed, and does not give a closed assignment back', async () => {
    const company = await prisma.company.findUniqueOrThrow({ where: { name: names[0]! } });
    await prisma.company.update({ where: { id: company.id }, data: { phone: '+90 000 000 00 00' } });
    const car = await prisma.fleetVehicle.findUniqueOrThrow({ where: { plate: '35 FLM 101' } });
    await prisma.fleetVehicle.update({ where: { id: car.id }, data: { nextMaintenanceOn: new Date('2031-01-01') } });
    // The person gave the car back: the assignment is closed, and the seed does not open it again.
    await prisma.vehicleAssignment.updateMany({ where: { fleetVehicleId: car.id }, data: { endedAt: new Date() } });

    await seedFleet(prisma, { password: 'baska-bir-parola-2' });
    expect((await prisma.company.findUniqueOrThrow({ where: { id: company.id } })).phone).toBe('+90 000 000 00 00');
    expect((await prisma.fleetVehicle.findUniqueOrThrow({ where: { id: car.id } })).nextMaintenanceOn?.toISOString().slice(0, 10)).toBe('2031-01-01');
    expect(await prisma.vehicleAssignment.count({ where: { fleetVehicleId: car.id, endedAt: null } })).toBe(0);
    // The password of a user that exists is not replaced either.
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0]! } });
    const { verifyPassword } = await import('../auth/password.js');
    expect(await verifyPassword('ornek-seed-parolasi-1', user.passwordHash!)).toBe(true);
  });

  it('without a password the companies are made and the users are not', async () => {
    await clean();
    const added = await seedFleet(prisma, { password: '' });
    expect(added.companies).toBe(2);
    expect(added.users).toBe(0);
    expect(await prisma.user.count({ where: { email: { in: emails } } })).toBe(0);
  });

  it('does not take over a plate a rented car has', async () => {
    await clean();
    const classId = created.classes[0]!;
    const model = await prisma.vehicleModel.create({
      data: { slug: `v35s-kiralik-${run}`, brand: 'Test', model: 'Kiralık', seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: 'PETROL', consumption: 5, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'T', en: 'T' }, classId },
    });
    const branch = await prisma.branch.create({
      data: { name: `Seed Bayi ${run}`, city: 'Test', address: 'Test', latitude: 1, longitude: 1, phone: '+90 000 000 00 00', email: `seed-${run}@example.test`, openingHours: { weekdays: { open: '08:00', close: '20:00' } } },
    });
    const rented = await prisma.vehicle.create({ data: { plate: '35 FLM 101', year: 2030, vehicleModelId: model.id, branchId: branch.id } });
    try {
      const added = await seedFleet(prisma, { password: '' });
      expect(added.cars).toBe(11);
      expect(await prisma.fleetVehicle.count({ where: { plate: '35 FLM 101' } })).toBe(0);
    } finally {
      await prisma.vehicle.delete({ where: { id: rented.id } });
      await prisma.branch.delete({ where: { id: branch.id } });
      await prisma.vehicleModel.delete({ where: { id: model.id } });
    }
  });
});
