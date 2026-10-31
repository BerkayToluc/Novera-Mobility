import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AdminContractsService } from '../admin/contracts/contracts.service.js';
import { AdminRequestsService } from '../admin/requests/requests.service.js';
import { AdminSummaryService } from '../admin/admin-summary.service.js';
import { testPlate } from '../common/plate.testing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FleetRequestsService } from './fleet-requests.service.js';
import { FleetSummaryService } from './fleet-summary.service.js';

// The service requests against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one (V2-41). Two
// companies, A and B. What is asked for A never finds B's and says "not found" like a record that is not there (ADR-25). Who may call the
// endpoints at all (401, 403) is in fleet.http.spec.ts and admin.http.spec.ts.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

const NOW = new Date('2026-10-31T10:00:00.000Z');

describeDb('the service requests against the database (V2-41)', () => {
  let prisma: PrismaService;
  let admin: AdminContractsService;
  let requests: FleetRequestsService;
  let desk: AdminRequestsService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', modelSlug: `v41r-model-${run}`, productSlug: `v41r-urun-${run}`, productId: '' };
  const A = { id: '', contract: '', car: { id: '', plate: '' }, car2: { id: '', plate: '' }, user: '' };
  const B = { id: '', contract: '', car: { id: '', plate: '' }, user: '' };
  const NONE = { id: '' };
  let adminUser = '';

  const roadside = { incident: 'BREAKDOWN', location: { address: 'D550 12. km, İzmir' }, description: 'Motor uyarı ışığı' };
  const replacement = { address: 'Alsancak, İzmir', date: '2026-11-03', durationDays: 5 };
  const maintenance = { service: 'WINTER_TIRES', preferredDate: '2026-11-10', valet: true, address: 'Bornova' };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new AdminContractsService(prisma);
    requests = new FleetRequestsService(prisma);
    desk = new AdminRequestsService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v41r-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: { slug: ids.modelSlug, brand: 'Filom', model: `Talep${run}`, seats: 5, bags: 3, transmission: 'AUTOMATIC', fuelType: 'PETROL', consumption: 5.5, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'Test', en: 'Test' }, classId: ids.classId },
      })
    ).id;
    ids.productId = (await prisma.product.create({ data: { slug: ids.productSlug } })).id;
    for (const [side, name] of [[A, 'A'], [B, 'B']] as const) {
      side.id = (await prisma.company.create({ data: { name: `V41R ${name} ${run}` } })).id;
      side.contract = (await admin.create(side.id, { productSlug: ids.productSlug, startAt: '2026-01-01', endAt: '2027-12-31', monthlyFee: 3_000_000, deliveryCity: 'İzmir' })).number;
      const plate = testPlate();
      side.car = { id: (await admin.createVehicle(side.contract, { modelSlug: ids.modelSlug, plate, year: 2025, startKm: 100 })).id, plate };
      side.user = (await prisma.user.create({ data: { email: `v41r-${name.toLowerCase()}-${run}@example.test`, firstName: 'Mert', lastName: 'Kaya', accountType: 'CORPORATE', companyId: side.id } })).id;
    }
    const plate2 = testPlate();
    A.car2 = { id: (await admin.createVehicle(A.contract, { modelSlug: ids.modelSlug, plate: plate2, year: 2025, startKm: 100 })).id, plate: plate2 };
    NONE.id = (await prisma.company.create({ data: { name: `V41R Bos ${run}` } })).id;
    adminUser = (await prisma.user.create({ data: { email: `v41r-admin-${run}@example.test`, firstName: 'Ece', lastName: 'Yönetici', role: 'ADMIN' } })).id;
  });

  afterEach(async () => {
    await prisma.serviceRequestEvent.deleteMany({ where: { request: { companyId: { in: [A.id, B.id] } } } });
    await prisma.serviceRequest.deleteMany({ where: { companyId: { in: [A.id, B.id] } } });
  });

  afterAll(async () => {
    const companyIds = [A.id, B.id, NONE.id];
    await prisma.serviceRequestEvent.deleteMany({ where: { request: { companyId: { in: companyIds } } } });
    await prisma.serviceRequest.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetVehicle.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.fleetContract.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [A.user, B.user, adminUser] } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  const make = (side: typeof A | typeof B, type: string, details: unknown, car = side.car) => requests.create(side.id, side.user, { type, fleetVehicleId: car.id, details }, NOW);

  describe('making a request', () => {
    it('opens one of each of the three kinds, received, with a number and the first line of its timeline', async () => {
      const road = await make(A, 'ROADSIDE', roadside);
      const swap = await make(A, 'REPLACEMENT_VEHICLE', replacement);
      const service = await make(A, 'MAINTENANCE', maintenance);
      for (const made of [road, swap, service]) {
        expect(made.number).toMatch(/^TLP-2026-\d{5,}$/);
        expect(made).toMatchObject({ status: 'RECEIVED', open: true, canCancel: true, vehicle: { plate: A.car.plate }, assignee: null, company: { id: A.id } });
        expect(made.events).toEqual([{ status: 'RECEIVED', note: null, at: NOW.toISOString(), by: 'COMPANY' }]);
      }
      expect(new Set([road.number, swap.number, service.number]).size).toBe(3);
      expect(road.details).toEqual({ incident: 'BREAKDOWN', location: { address: 'D550 12. km, İzmir', latitude: null, longitude: null }, description: 'Motor uyarı ışığı' });
      expect(service.details).toMatchObject({ service: 'WINTER_TIRES', valet: true, address: 'Bornova' });
    });

    it('refuses details that do not fit the kind (422), naming the field, and writes nothing', async () => {
      const cases: Array<[string, unknown, Record<string, string>]> = [
        ['ROADSIDE', { ...roadside, incident: 'FLOOD' }, { 'details.incident': 'INVALID_FORMAT' }],
        ['ROADSIDE', { incident: 'TIRE' }, { 'details.location': 'REQUIRED' }],
        ['REPLACEMENT_VEHICLE', { ...replacement, durationDays: 0 }, { 'details.durationDays': 'OUT_OF_RANGE' }],
        ['REPLACEMENT_VEHICLE', roadside, { 'details.durationDays': 'REQUIRED', 'details.address': 'REQUIRED', 'details.date': 'REQUIRED' }],
        ['MAINTENANCE', { ...maintenance, valet: true, address: '' }, { 'details.address': 'REQUIRED' }],
        ['MAINTENANCE', { ...maintenance, preferredDate: '2026-10-01' }, { 'details.preferredDate': 'OUT_OF_RANGE' }],
        ['MAINTENANCE', undefined, { details: 'REQUIRED' }],
      ];
      for (const [type, details, fieldErrors] of cases) {
        const answer = await refused(make(A, type, details));
        expect([type, answer.status, answer.body.fieldErrors]).toEqual([type, 422, fieldErrors]);
      }
      expect(await prisma.serviceRequest.count({ where: { companyId: A.id } })).toBe(0);
    });

    it('needs a kind that exists and is open to the company, and a car of the company that is in use', async () => {
      expect((await refused(requests.create(A.id, A.user, { type: 'WASH', fleetVehicleId: A.car.id, details: {} }, NOW))).body.fieldErrors).toEqual({ type: 'INVALID_FORMAT' });
      // A transfer is for companies with a VIP Mobilite contract only (V2-42): company A has none here, so it is 403, not a field problem.
      expect((await refused(requests.create(A.id, A.user, { type: 'TRANSFER', details: {} }, NOW))).status).toBe(403);
      expect((await refused(requests.create(A.id, A.user, { type: 'ROADSIDE', details: roadside }, NOW))).body.fieldErrors).toEqual({ fleetVehicleId: 'REQUIRED' });
      expect((await refused(requests.create(A.id, A.user, { type: 'ROADSIDE', fleetVehicleId: 'x', details: roadside }, NOW))).body.fieldErrors).toEqual({ fleetVehicleId: 'INVALID_FORMAT' });
      // Another company's car and one that is not there are the same answer.
      const foreign = await refused(make(A, 'ROADSIDE', roadside, B.car));
      const missing = await refused(requests.create(A.id, A.user, { type: 'ROADSIDE', fleetVehicleId: randomUUID(), details: roadside }, NOW));
      expect(foreign.body).toEqual(missing.body);
      expect(foreign.body.fieldErrors).toEqual({ fleetVehicleId: 'UNKNOWN_REFERENCE' });
      // A car that was given back.
      await prisma.fleetVehicle.update({ where: { id: A.car2.id }, data: { status: 'RETURNED', returnedAt: NOW } });
      try {
        expect((await refused(make(A, 'ROADSIDE', roadside, A.car2))).body.fieldErrors).toEqual({ fleetVehicleId: 'UNKNOWN_REFERENCE' });
      } finally {
        await prisma.fleetVehicle.update({ where: { id: A.car2.id }, data: { status: 'ACTIVE', returnedAt: null } });
      }
      expect(await prisma.serviceRequest.count({ where: { companyId: A.id } })).toBe(0);
    });

    it('says which other requests of the kind are still open for the car: a notice, not an obstacle', async () => {
      const first = await make(A, 'ROADSIDE', roadside);
      expect(first.similarOpen).toEqual([]);
      const second = await make(A, 'ROADSIDE', roadside);
      expect(second.similarOpen).toEqual([first.number]);
      // Another kind, another car and another company are not "similar".
      expect((await make(A, 'MAINTENANCE', maintenance)).similarOpen).toEqual([]);
      expect((await make(A, 'ROADSIDE', roadside, A.car2)).similarOpen).toEqual([]);
      expect((await make(B, 'ROADSIDE', roadside)).similarOpen).toEqual([]);
      // A request that is over is no longer open.
      await desk.setStatus(first.number, adminUser, { status: 'COMPLETED' }, NOW);
      await desk.setStatus(second.number, adminUser, { status: 'CANCELLED' }, NOW);
      expect((await make(A, 'ROADSIDE', roadside)).similarOpen).toEqual([]);
    });
  });

  describe('withdrawing a request', () => {
    it('is possible only while it is received; the timeline says the company did it', async () => {
      const made = await make(A, 'ROADSIDE', roadside);
      const cancelled = await requests.cancel(A.id, A.user, made.number.toLowerCase(), new Date(NOW.getTime() + 60_000));
      expect(cancelled).toMatchObject({ status: 'CANCELLED', open: false, canCancel: false, nextStatuses: [] });
      expect(cancelled.events.map((e) => [e.status, e.by])).toEqual([['RECEIVED', 'COMPANY'], ['CANCELLED', 'COMPANY']]);
      const again = await refused(requests.cancel(A.id, A.user, made.number));
      expect([again.status, again.body.code]).toEqual([409, 'INVALID_TRANSITION']);
    });

    it('is refused once Novera has taken the request up, and nothing is written', async () => {
      const made = await make(A, 'MAINTENANCE', maintenance);
      await desk.setStatus(made.number, adminUser, { status: 'SCHEDULED', note: 'Salı 10:00' }, NOW);
      const answer = await refused(requests.cancel(A.id, A.user, made.number));
      expect([answer.status, answer.body.code]).toEqual([409, 'INVALID_TRANSITION']);
      expect((await requests.get(A.id, made.number)).status).toBe('SCHEDULED');
      expect((await requests.get(A.id, made.number)).events).toHaveLength(2);
    });
  });

  describe('another company’s request is a 404', () => {
    it('cannot be opened or cancelled through the other company, and the answer is the one for a request that is not there', async () => {
      const theirs = await make(B, 'ROADSIDE', roadside);
      const answers = await Promise.all([refused(requests.get(A.id, theirs.number)), refused(requests.cancel(A.id, A.user, theirs.number))]);
      const nothing = await refused(requests.get(A.id, 'TLP-2026-99999'));
      for (const answer of answers) expect(answer).toEqual(nothing);
      expect(nothing.status).toBe(404);
      expect((await refused(requests.get(A.id, 'nope'))).status).toBe(404);
      expect((await prisma.serviceRequest.findUniqueOrThrow({ where: { number: theirs.number } })).status).toBe('RECEIVED');
      expect((await requests.list(A.id, {})).total).toBe(0);
      expect((await requests.list(B.id, {})).total).toBe(1);
      expect((await requests.get(B.id, theirs.number)).number).toBe(theirs.number);
    });
  });

  describe('the list', () => {
    it('is the company’s own, newest first, and narrows by kind, step, car and whether it is still open', async () => {
      const road = await make(A, 'ROADSIDE', roadside);
      const swap = await requests.create(A.id, A.user, { type: 'REPLACEMENT_VEHICLE', fleetVehicleId: A.car2.id, details: replacement }, new Date(NOW.getTime() + 1_000));
      const done = await make(A, 'MAINTENANCE', maintenance);
      await desk.setStatus(done.number, adminUser, { status: 'COMPLETED' }, NOW);
      await make(B, 'ROADSIDE', roadside);

      const all = await requests.list(A.id, {});
      expect(all.total).toBe(3);
      expect(all.items[0]!.number).toBe(swap.number);
      expect(all.items.every((item) => item.company.id === A.id)).toBe(true);
      expect((await requests.list(A.id, { type: 'ROADSIDE' })).items.map((i) => i.number)).toEqual([road.number]);
      expect((await requests.list(A.id, { status: 'COMPLETED' })).items.map((i) => i.number)).toEqual([done.number]);
      expect((await requests.list(A.id, { vehicle: A.car2.id })).items.map((i) => i.number)).toEqual([swap.number]);
      expect((await requests.list(A.id, { open: 'true' })).items.map((i) => i.number).sort()).toEqual([road.number, swap.number].sort());
      expect((await requests.list(A.id, { open: 'false' })).items.map((i) => i.number)).toEqual([done.number]);
      expect((await requests.list(NONE.id, {})).total).toBe(0);
    });

    it('is 422 for a list asked for in a way that makes no sense', async () => {
      for (const query of [{ sort: 'type:asc' }, { type: 'WASH' }, { status: 'LATE' }, { open: 'maybe' }, { vehicle: 'x' }, { pageSize: '101' }]) {
        expect([query, (await refused(requests.list(A.id, query))).status]).toEqual([query, 422]);
      }
    });
  });

  describe('the summary', () => {
    it('counts the open requests of the company, and the administration counts all of them', async () => {
      await make(A, 'ROADSIDE', roadside);
      const gone = await make(A, 'MAINTENANCE', maintenance);
      await requests.cancel(A.id, A.user, gone.number);
      const other = await make(B, 'REPLACEMENT_VEHICLE', replacement);
      await desk.setStatus(other.number, adminUser, { status: 'DELIVERED' }, NOW);
      expect((await new FleetSummaryService(prisma).get(A.id, NOW)).requests).toEqual({ open: 1 });
      expect((await new FleetSummaryService(prisma).get(B.id, NOW)).requests).toEqual({ open: 1 });
      expect((await new FleetSummaryService(prisma).get(NONE.id, NOW)).requests).toEqual({ open: 0 });
      const before = (await new AdminSummaryService(prisma).get(NOW)).serviceRequests!;
      await make(A, 'ROADSIDE', roadside);
      expect((await new AdminSummaryService(prisma).get(NOW)).serviceRequests).toBe(before + 1);
    });
  });

  describe('the administration moves a request', () => {
    it('along the steps of its kind, with a note and who is on it, and the timeline says Novera did it', async () => {
      const made = await make(A, 'ROADSIDE', roadside);
      const dispatched = await desk.setStatus(made.number.toLowerCase(), adminUser, { status: 'DISPATCHED', note: 'Çekici yola çıktı', assignee: 'Ege Çekici, 0532 000 00 00' }, new Date(NOW.getTime() + 60_000));
      expect(dispatched).toMatchObject({ status: 'DISPATCHED', assignee: 'Ege Çekici, 0532 000 00 00', canCancel: false, nextStatuses: ['EN_ROUTE', 'COMPLETED', 'CANCELLED'] });
      const onTheWay = await desk.setStatus(made.number, adminUser, { status: 'EN_ROUTE' }, new Date(NOW.getTime() + 120_000));
      // Missing keeps who is on it; empty clears it.
      expect(onTheWay.assignee).toBe('Ege Çekici, 0532 000 00 00');
      expect(onTheWay.events.map((e) => [e.status, e.note, e.by])).toEqual([['RECEIVED', null, 'COMPANY'], ['DISPATCHED', 'Çekici yola çıktı', 'NOVERA'], ['EN_ROUTE', null, 'NOVERA']]);
      const done = await desk.setStatus(made.number, adminUser, { status: 'COMPLETED', assignee: '' }, new Date(NOW.getTime() + 180_000));
      expect(done).toMatchObject({ status: 'COMPLETED', open: false, assignee: null, nextStatuses: [] });
      // The customer sees the same timeline, in the same order.
      expect((await requests.get(A.id, made.number)).events.map((e) => e.status)).toEqual(['RECEIVED', 'DISPATCHED', 'EN_ROUTE', 'COMPLETED']);
    });

    it('refuses a step back, the same step, a step of another kind and any move out of a finished request (409 INVALID_TRANSITION)', async () => {
      const road = await make(A, 'ROADSIDE', roadside);
      await desk.setStatus(road.number, adminUser, { status: 'EN_ROUTE' }, NOW);
      const bad: Array<[string, string]> = [[road.number, 'DISPATCHED'], [road.number, 'EN_ROUTE'], [road.number, 'DELIVERED'], [road.number, 'RECEIVED']];
      for (const [number, status] of bad) {
        const answer = await refused(desk.setStatus(number, adminUser, { status }, NOW));
        expect([status, answer.status, answer.body.code]).toEqual([status, 409, 'INVALID_TRANSITION']);
      }
      await desk.setStatus(road.number, adminUser, { status: 'COMPLETED' }, NOW);
      for (const status of ['CANCELLED', 'COMPLETED', 'EN_ROUTE']) expect((await refused(desk.setStatus(road.number, adminUser, { status }, NOW))).body.code).toBe('INVALID_TRANSITION');
      // A step may be skipped, and a request can be cancelled from any step but the last.
      const skip = await make(A, 'REPLACEMENT_VEHICLE', replacement);
      expect((await desk.setStatus(skip.number, adminUser, { status: 'DELIVERED' }, NOW)).status).toBe('DELIVERED');
      expect((await desk.setStatus(skip.number, adminUser, { status: 'CANCELLED', note: 'Vazgeçti' }, NOW)).status).toBe('CANCELLED');
      expect(await prisma.serviceRequestEvent.count({ where: { request: { number: road.number } } })).toBe(3);
    });

    it('two moves at the same moment take turns: the second is judged against where the first left the request', async () => {
      const made = await make(A, 'MAINTENANCE', maintenance);
      const results = await Promise.allSettled([desk.setStatus(made.number, adminUser, { status: 'SCHEDULED' }, NOW), desk.setStatus(made.number, adminUser, { status: 'SCHEDULED' }, NOW)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.serviceRequestEvent.count({ where: { request: { number: made.number }, status: 'SCHEDULED' } })).toBe(1);
    });

    it('needs a step that exists and a note and assignee that are short enough; a number that cannot be one is 404', async () => {
      const made = await make(A, 'ROADSIDE', roadside);
      expect((await refused(desk.setStatus(made.number, adminUser, {}, NOW))).body.fieldErrors).toEqual({ status: 'REQUIRED' });
      expect((await refused(desk.setStatus(made.number, adminUser, { status: 'LOST' }, NOW))).body.fieldErrors).toEqual({ status: 'INVALID_FORMAT' });
      expect((await refused(desk.setStatus(made.number, adminUser, { status: 'DISPATCHED', note: 'n'.repeat(501), assignee: 'a'.repeat(201) }, NOW))).body.fieldErrors).toEqual({ note: 'TOO_LONG', assignee: 'TOO_LONG' });
      expect((await refused(desk.setStatus('nope', adminUser, { status: 'DISPATCHED' }, NOW))).status).toBe(404);
      expect((await refused(desk.setStatus('TLP-2026-99999', adminUser, { status: 'DISPATCHED' }, NOW))).status).toBe(404);
      expect((await requests.get(A.id, made.number)).status).toBe('RECEIVED');
    });

    it('lists the requests of all the companies, by kind, step, company and a word, and opens one', async () => {
      const road = await make(A, 'ROADSIDE', roadside);
      const swap = await make(B, 'REPLACEMENT_VEHICLE', replacement);
      const mine = (query: Record<string, string>) => desk.list({ pageSize: '100', ...query }).then((page) => page.items.map((i) => i.number));
      expect(await mine({})).toEqual(expect.arrayContaining([road.number, swap.number]));
      expect(await mine({ company: A.id })).toEqual([road.number]);
      expect(await mine({ company: B.id, type: 'REPLACEMENT_VEHICLE' })).toEqual([swap.number]);
      expect(await mine({ company: A.id, type: 'MAINTENANCE' })).toEqual([]);
      expect(await mine({ q: A.car.plate.toLowerCase() })).toEqual([road.number]);
      expect(await mine({ q: `V41R B ${run}`.toLowerCase() })).toEqual([swap.number]);
      expect(await mine({ q: road.number.slice(4) })).toEqual([road.number]);
      await desk.setStatus(road.number, adminUser, { status: 'COMPLETED' }, NOW);
      expect(await mine({ company: A.id, open: 'false' })).toEqual([road.number]);
      expect(await mine({ company: A.id, open: 'true' })).toEqual([]);
      expect((await desk.get(swap.number)).company).toEqual({ id: B.id, name: `V41R B ${run}` });
      expect((await refused(desk.list({ type: 'WASH' }))).status).toBe(422);
    });
  });

  describe('a VIP transfer (V2-42)', () => {
    let vipProductId = '';
    let madeVipProduct = false;
    let vipContract = '';
    const transfer = (at: Date = NOW) => ({
      passengerName: 'Ada Kaya',
      passengers: 3,
      flightNumber: ' tk 1234',
      meeting: { airport: 'ADB' },
      meetingAt: new Date(at.getTime() + 5 * 3_600_000).toISOString(),
      destination: 'Alsancak, İzmir',
      note: 'Tabelayla karşılama',
    });
    const ask = (side: typeof A | typeof B, body: Record<string, unknown>) => requests.create(side.id, side.user, { type: 'TRANSFER', ...body }, NOW);

    beforeAll(async () => {
      const found = await prisma.product.findUnique({ where: { slug: 'vip-mobilite' } });
      vipProductId = found?.id ?? (await prisma.product.create({ data: { slug: 'vip-mobilite' } })).id;
      madeVipProduct = !found;
      vipContract = (await admin.create(A.id, { productSlug: 'vip-mobilite', startAt: '2026-01-01', endAt: '2027-12-31', monthlyFee: 7_500_000, deliveryCity: 'İzmir' })).number;
    });

    afterAll(async () => {
      // The contract goes with the rest of the clean-up at the end; the product only if this test made it.
      await prisma.serviceRequestEvent.deleteMany({ where: { request: { companyId: { in: [A.id, B.id] } } } });
      await prisma.serviceRequest.deleteMany({ where: { companyId: { in: [A.id, B.id] } } });
      await prisma.fleetContract.deleteMany({ where: { number: vipContract } });
      if (madeVipProduct) await prisma.product.deleteMany({ where: { id: vipProductId } });
    });

    it('opens for a company with a VIP contract: received, without a car, with the details as they are kept', async () => {
      const made = await ask(A, { details: transfer() });
      expect(made).toMatchObject({ status: 'RECEIVED', type: 'TRANSFER', vehicle: null, open: true, canCancel: true, similarOpen: [], assignee: null });
      expect(made.details).toEqual({ ...transfer(), flightNumber: 'TK1234', meeting: { airport: 'ADB', address: null }, meetingAt: new Date(NOW.getTime() + 5 * 3_600_000).toISOString() });
      expect(made.events.map((e) => [e.status, e.by])).toEqual([['RECEIVED', 'COMPANY']]);
      expect((await prisma.serviceRequest.findUniqueOrThrow({ where: { number: made.number } })).fleetVehicleId).toBeNull();
      // Two of them for the same passenger are no "similar" ones: there is no car to be the same.
      expect((await ask(A, { details: transfer() })).similarOpen).toEqual([]);
    });

    it('is 403 FORBIDDEN for a company with no VIP contract, whatever it sends, and for one whose contract is over', async () => {
      for (const body of [{ details: transfer() }, { details: {} }, {}, { fleetVehicleId: B.car.id, details: transfer() }]) {
        const answer = await refused(ask(B, body));
        expect([answer.status, answer.body.code]).toEqual([403, 'FORBIDDEN']);
      }
      await prisma.fleetContract.update({ where: { number: vipContract }, data: { status: 'ENDED' } });
      try {
        expect((await refused(ask(A, { details: transfer() }))).status).toBe(403);
      } finally {
        await prisma.fleetContract.update({ where: { number: vipContract }, data: { status: 'ACTIVE' } });
      }
      expect(await prisma.serviceRequest.count({ where: { companyId: B.id } })).toBe(0);
    });

    it('is not about a car, and the details are checked field by field (422)', async () => {
      expect((await refused(ask(A, { fleetVehicleId: A.car.id, details: transfer() }))).body.fieldErrors).toEqual({ fleetVehicleId: 'NOT_ALLOWED' });
      expect((await refused(ask(A, { details: {} }))).body.fieldErrors).toEqual({
        'details.passengerName': 'REQUIRED',
        'details.passengers': 'REQUIRED',
        'details.meeting': 'REQUIRED',
        'details.meetingAt': 'REQUIRED',
        'details.destination': 'REQUIRED',
      });
      const soon = { ...transfer(), meetingAt: new Date(NOW.getTime() + 3_600_000).toISOString() };
      expect((await refused(ask(A, { details: soon }))).body.fieldErrors).toEqual({ 'details.meetingAt': 'OUT_OF_RANGE' });
      expect((await refused(ask(A, { details: { ...transfer(), passengers: 8, flightNumber: 'x' } }))).body.fieldErrors).toEqual({ 'details.passengers': 'OUT_OF_RANGE', 'details.flightNumber': 'INVALID_FORMAT' });
      expect(await prisma.serviceRequest.count({ where: { companyId: A.id } })).toBe(0);
    });

    it('cannot be moved to the driver, the meeting or the end without a driver written down; cancelling needs none', async () => {
      const made = await ask(A, { details: transfer() });
      for (const status of ['DRIVER_ASSIGNED', 'MET', 'COMPLETED']) {
        const answer = await refused(desk.setStatus(made.number, adminUser, { status, note: 'x' }, NOW));
        expect([status, answer.status, answer.body.fieldErrors]).toEqual([status, 422, { assignee: 'REQUIRED' }]);
        const blank = await refused(desk.setStatus(made.number, adminUser, { status, assignee: '   ' }, NOW));
        expect([status, blank.status]).toEqual([status, 422]);
      }
      expect((await requests.get(A.id, made.number)).status).toBe('RECEIVED');
      expect((await requests.get(A.id, made.number)).events).toHaveLength(1);

      const assigned = await desk.setStatus(made.number, adminUser, { status: 'DRIVER_ASSIGNED', assignee: 'Mehmet Usta, 0532 000 00 02, 35 VIP 001 siyah Mercedes V-Class' }, new Date(NOW.getTime() + 60_000));
      expect(assigned).toMatchObject({ status: 'DRIVER_ASSIGNED', assignee: 'Mehmet Usta, 0532 000 00 02, 35 VIP 001 siyah Mercedes V-Class', nextStatuses: ['MET', 'COMPLETED', 'CANCELLED'] });
      // The driver stays for the steps after; taking him off at the meeting is refused.
      expect((await desk.setStatus(made.number, adminUser, { status: 'MET' }, new Date(NOW.getTime() + 120_000))).assignee).toContain('Mehmet Usta');
      expect((await refused(desk.setStatus(made.number, adminUser, { status: 'COMPLETED', assignee: '' }, NOW))).body.fieldErrors).toEqual({ assignee: 'REQUIRED' });
      expect((await desk.setStatus(made.number, adminUser, { status: 'COMPLETED' }, new Date(NOW.getTime() + 180_000))).open).toBe(false);
      expect((await requests.get(A.id, made.number)).events.map((e) => e.status)).toEqual(['RECEIVED', 'DRIVER_ASSIGNED', 'MET', 'COMPLETED']);

      const other = await ask(A, { details: transfer() });
      expect((await desk.setStatus(other.number, adminUser, { status: 'CANCELLED', note: 'Uçuş iptal' }, NOW)).status).toBe('CANCELLED');
    });

    it('is cancelled by the company while received; another company’s transfer is a 404 for it; the summary says who can ask', async () => {
      const made = await ask(A, { details: transfer() });
      expect((await requests.cancel(A.id, A.user, made.number, NOW)).status).toBe('CANCELLED');
      const mine = await ask(A, { details: transfer() });
      expect((await refused(requests.get(B.id, mine.number))).status).toBe(404);
      expect((await refused(requests.cancel(B.id, B.user, mine.number))).status).toBe(404);
      expect((await new FleetSummaryService(prisma).get(A.id, NOW)).hasVipContract).toBe(true);
      expect((await new FleetSummaryService(prisma).get(B.id, NOW)).hasVipContract).toBe(false);
      expect(await requests.hasVipContract(A.id)).toBe(true);
      expect(await requests.hasVipContract(B.id)).toBe(false);
      // Open ones are counted like the others, and listed under their kind.
      expect((await requests.list(A.id, { type: 'TRANSFER', open: 'true' })).items.map((i) => i.number)).toEqual([mine.number]);
      expect((await new FleetSummaryService(prisma).get(A.id, NOW)).requests.open).toBe(1);
    });

    it('the database keeps a transfer to the steps of a transfer', async () => {
      const made = await ask(A, { details: transfer() });
      await expect(prisma.serviceRequest.update({ where: { number: made.number }, data: { status: 'DELIVERED' } })).rejects.toThrow();
      await expect(prisma.serviceRequest.update({ where: { number: made.number }, data: { status: 'DRIVER_ASSIGNED' } })).resolves.toBeTruthy();
    });
  });

  describe('the database itself', () => {
    it('refuses a step that the kind does not have, a car of another company, and a kind that is not about a car', async () => {
      const made = await make(A, 'ROADSIDE', roadside);
      await expect(prisma.serviceRequest.update({ where: { number: made.number }, data: { status: 'DELIVERED' } })).rejects.toThrow();
      await expect(prisma.serviceRequest.update({ where: { number: made.number }, data: { fleetVehicleId: B.car.id } })).rejects.toThrow();
      await expect(prisma.serviceRequest.update({ where: { number: made.number }, data: { fleetVehicleId: null } })).rejects.toThrow();
      await expect(prisma.serviceRequest.update({ where: { number: made.number }, data: { details: [] } })).rejects.toThrow();
      await expect(prisma.serviceRequest.update({ where: { number: made.number }, data: { assignee: 'a'.repeat(201) } })).rejects.toThrow();
      await expect(prisma.serviceRequest.create({ data: { number: `TLP-2026-9${run.slice(0, 4).replace(/\D/g, '0')}`, companyId: A.id, type: 'MAINTENANCE', fleetVehicleId: B.car.id, details: {} } })).rejects.toThrow();
      // The same request, undamaged by all of that.
      expect(await prisma.serviceRequest.findUniqueOrThrow({ where: { number: made.number } })).toMatchObject({ status: 'RECEIVED', fleetVehicleId: A.car.id });
    });
  });
});
