// The sample fleet customers (V2-35, docs/FLEET.md §5): two made-up companies with a contract, cars, people, assignments and
// readings, so the panels are full on the first opening. Like the rest of the seed it only ADDS what is missing and never overwrites
// what is there (QUALITY §3.3): run again on a live database it makes no copy, and a company, a car or a person that a person has
// changed is left as it is. The users get the password of `FLEET_SEED_PASSWORD`, which is never written in the repository; without it
// the companies are made and the users are not.
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/auth/password.js";
import { addDays, parseDay } from "../src/fleet/fleet-dates.js";
import { dueDayOf, lineOf, periodRange, totalsOf, type InvoiceLine } from "../src/fleet/invoice-calc.js";

type Db = Pick<PrismaClient, "company" | "user" | "product" | "vehicleModel" | "vehicle" | "fleetContract" | "fleetVehicle" | "companyEmployee" | "vehicleAssignment" | "vehicleReading" | "fleetInvoice" | "$queryRaw">;

type CarSeed = { plate: string; modelSlug: string; year: number; startKm: number; maintenanceInDays: number; inspectionInDays: number };
type PersonSeed = { firstName: string; lastName: string; department: string; employeeNo: string; email: string; phone: string };
type ContractSeed = { productSlug: string; startAt: string; endAt: string; monthlyFee: number; deliveryCity: string; cars: CarSeed[] };
type CompanySeed = {
  name: string;
  taxOffice: string;
  city: string;
  phone: string;
  user: { email: string; firstName: string; lastName: string; title: string };
  contracts: ContractSeed[];
  people: PersonSeed[];
  // Which person has which car, by plate (the first person in the list has the first car ...).
  assigned: Record<string, string>;
};

const car = (plate: string, modelSlug: string, year: number, startKm: number, maintenanceInDays: number, inspectionInDays: number): CarSeed => ({
  plate,
  modelSlug,
  year,
  startKm,
  maintenanceInDays,
  inspectionInDays,
});
const person = (n: number, prefix: string, firstName: string, lastName: string, department: string, domain: string): PersonSeed => ({
  firstName,
  lastName,
  department,
  employeeNo: `${prefix}-${String(n).padStart(3, "0")}`,
  email: `${firstName}.${lastName}@${domain}`.toLowerCase().replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u"),
  phone: `+90 532 555 ${String(10 + n).padStart(2, "0")} ${String(20 + n).padStart(2, "0")}`,
});

// 12 cars: 4 electric and 2 hybrid at the green company, 6 on petrol and diesel at the logistics company; 15 people.
export const FLEET_SEEDS: CompanySeed[] = [
  {
    name: "Örnek Lojistik A.Ş.",
    taxOffice: "Bornova",
    city: "İzmir",
    phone: "+90 232 555 40 00",
    user: { email: "filo@ornek-lojistik.example", firstName: "Mert", lastName: "Kaya", title: "Filo Müdürü" },
    contracts: [
      {
        productSlug: "akilli-kurumsal-filo",
        startAt: "2026-01-15",
        endAt: "2027-01-14",
        monthlyFee: 10_800_000,
        deliveryCity: "İzmir",
        cars: [
          car("35 FLM 101", "fiat-egea", 2025, 18_400, 12, 150),
          car("35 FLM 102", "fiat-egea", 2025, 16_950, 25, 150),
          car("35 FLM 103", "renault-clio", 2025, 12_300, 40, 200),
          car("35 FLM 104", "volkswagen-passat", 2024, 41_200, 8, 90),
          car("35 FLM 105", "dacia-duster", 2025, 9_800, 55, 220),
          car("35 FLM 106", "renault-megane-sedan", 2024, 33_700, 20, 120),
        ],
      },
    ],
    people: [
      person(1, "ORN", "Ayşe", "Demir", "Satış", "ornek-lojistik.example"),
      person(2, "ORN", "Burak", "Yılmaz", "Satış", "ornek-lojistik.example"),
      person(3, "ORN", "Cansu", "Arslan", "Operasyon", "ornek-lojistik.example"),
      person(4, "ORN", "Deniz", "Çelik", "Operasyon", "ornek-lojistik.example"),
      person(5, "ORN", "Emre", "Şahin", "Depo", "ornek-lojistik.example"),
      person(6, "ORN", "Fatma", "Öztürk", "Finans", "ornek-lojistik.example"),
      person(7, "ORN", "Gökhan", "Aydın", "Satış", "ornek-lojistik.example"),
      person(8, "ORN", "Hülya", "Koç", "İnsan Kaynakları", "ornek-lojistik.example"),
      person(9, "ORN", "İlker", "Polat", "Operasyon", "ornek-lojistik.example"),
    ],
    assigned: { "35 FLM 101": "ORN-001", "35 FLM 102": "ORN-002", "35 FLM 103": "ORN-003", "35 FLM 104": "ORN-007" },
  },
  {
    name: "Yeşil Enerji Ltd.",
    taxOffice: "Çankaya",
    city: "Ankara",
    phone: "+90 312 555 41 00",
    user: { email: "filo@yesil-enerji.example", firstName: "Selin", lastName: "Aksoy", title: "Operasyon Müdürü" },
    contracts: [
      {
        productSlug: "yesil-filo",
        startAt: "2026-03-01",
        endAt: "2027-02-28",
        monthlyFee: 21_600_000,
        deliveryCity: "Ankara",
        cars: [
          car("06 FLM 201", "togg-t10x", 2025, 8_900, 30, 300),
          car("06 FLM 202", "togg-t10x", 2025, 7_450, 45, 300),
          car("06 FLM 203", "hyundai-ioniq-5", 2025, 11_200, 18, 280),
          car("06 FLM 204", "tesla-model-y", 2025, 13_800, 70, 260),
          car("06 FLM 205", "toyota-corolla-hybrid", 2025, 14_600, 35, 240),
          car("06 FLM 206", "nissan-qashqai", 2024, 27_300, 6, 100),
        ],
      },
      { productSlug: "vip-mobilite", startAt: "2026-06-01", endAt: "2027-05-31", monthlyFee: 7_500_000, deliveryCity: "Ankara", cars: [] },
    ],
    people: [
      person(1, "YES", "Kerem", "Doğan", "Yönetim", "yesil-enerji.example"),
      person(2, "YES", "Leyla", "Güneş", "Satış", "yesil-enerji.example"),
      person(3, "YES", "Murat", "Kılıç", "Teknik", "yesil-enerji.example"),
      person(4, "YES", "Nilay", "Tekin", "Teknik", "yesil-enerji.example"),
      person(5, "YES", "Orhan", "Bulut", "Satış", "yesil-enerji.example"),
      person(6, "YES", "Pınar", "Erdem", "Finans", "yesil-enerji.example"),
    ],
    assigned: { "06 FLM 201": "YES-001", "06 FLM 202": "YES-002", "06 FLM 203": "YES-003", "06 FLM 205": "YES-005" },
  },
];

const DAY = 86_400_000;
const ELECTRIC = new Set(["togg-t10x", "hyundai-ioniq-5", "tesla-model-y"]);
const HYBRID = new Set(["toyota-corolla-hybrid", "nissan-qashqai", "toyota-rav4-hybrid"]);

const day = (date: string): Date => new Date(`${date}T00:00:00.000Z`);
const dayOf = (now: Date, offsetDays: number): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));

export type FleetSeedResult = { companies: number; users: number; contracts: number; cars: number; people: number; assignments: number; readings: number; invoices: number };

// Adds what is missing and says how much it added. `password` is the one for the sample users; empty means no user is made.
export async function seedFleet(db: Db, options: { password?: string | null; now?: Date; seeds?: CompanySeed[] } = {}): Promise<FleetSeedResult> {
  const now = options.now ?? new Date();
  const result: FleetSeedResult = { companies: 0, users: 0, contracts: 0, cars: 0, people: 0, assignments: 0, readings: 0, invoices: 0 };
  const passwordHash = options.password ? await hashPassword(options.password) : null;

  for (const [seedIndex, seed] of (options.seeds ?? FLEET_SEEDS).entries()) {
    // The name is unique: a company that has it is left exactly as it is.
    let company = await db.company.findUnique({ where: { name: seed.name } });
    if (!company) {
      company = await db.company.create({ data: { name: seed.name, taxOffice: seed.taxOffice, city: seed.city, phone: seed.phone } });
      result.companies += 1;
    }

    if (passwordHash) {
      const user = await db.user.findUnique({ where: { email: seed.user.email } });
      if (!user) {
        await db.user.create({ data: { email: seed.user.email, passwordHash, firstName: seed.user.firstName, lastName: seed.user.lastName, accountType: "CORPORATE", companyId: company.id, contactTitle: seed.user.title } });
        result.users += 1;
      }
    }

    const people = new Map<string, string>();
    for (const p of seed.people) {
      const found = await db.companyEmployee.findUnique({ where: { companyId_employeeNo: { companyId: company.id, employeeNo: p.employeeNo } } });
      if (found) {
        people.set(p.employeeNo, found.id);
        continue;
      }
      const made = await db.companyEmployee.create({ data: { companyId: company.id, ...p } });
      people.set(p.employeeNo, made.id);
      result.people += 1;
    }

    for (const c of seed.contracts) {
      const product = await db.product.findUnique({ where: { slug: c.productSlug } });
      if (!product) throw new Error(`Ürün yok: ${c.productSlug} (önce ana seed çalışmalı)`);
      let contract = await db.fleetContract.findFirst({ where: { companyId: company.id, productId: product.id } });
      if (!contract) {
        const [{ serial }] = await db.$queryRaw<{ serial: bigint }[]>`SELECT nextval('"FleetContractNumber_seq"') AS serial`;
        const number = `SZL-${now.getUTCFullYear()}-${String(serial).padStart(5, "0")}`;
        contract = await db.fleetContract.create({
          data: { number, companyId: company.id, productId: product.id, startAt: day(c.startAt), endAt: day(c.endAt), monthlyFee: c.monthlyFee, deliveryCity: c.deliveryCity },
        });
        result.contracts += 1;
      }

      for (const [index, s] of c.cars.entries()) {
        let vehicle = await db.fleetVehicle.findUnique({ where: { plate: s.plate } });
        if (!vehicle) {
          // The plate is one car: a rented car that has it is not taken over.
          if (await db.vehicle.findUnique({ where: { plate: s.plate }, select: { id: true } })) {
            console.warn(`  ${s.plate} plakası kiralık bir araçta; filo aracı atlandı.`);
            continue;
          }
          const model = await db.vehicleModel.findUnique({ where: { slug: s.modelSlug } });
          if (!model) throw new Error(`Model yok: ${s.modelSlug} (önce ana seed çalışmalı)`);
          vehicle = await db.fleetVehicle.create({
            data: {
              contractId: contract.id,
              companyId: company.id,
              vehicleModelId: model.id,
              plate: s.plate,
              year: s.year,
              startKm: s.startKm,
              nextMaintenanceOn: dayOf(now, s.maintenanceInDays),
              inspectionDueOn: dayOf(now, s.inspectionInDays),
            },
          });
          result.cars += 1;
        }

        // A car with any reading, or any assignment, is left alone: only an empty one is filled.
        const employeeNo = seed.assigned[s.plate];
        if (employeeNo && people.has(employeeNo) && (await db.vehicleAssignment.count({ where: { fleetVehicleId: vehicle.id } })) === 0) {
          await db.vehicleAssignment.create({
            data: { companyId: company.id, fleetVehicleId: vehicle.id, employeeId: people.get(employeeNo)!, startedAt: new Date(now.getTime() - (60 + index * 7) * DAY), note: "Örnek zimmet" },
          });
          result.assignments += 1;
        }
        if ((await db.vehicleReading.count({ where: { fleetVehicleId: vehicle.id } })) === 0) {
          // One reading a month for the last three months: the kilometre grows, the fuel or the charge moves, the battery of an
          // electric or hybrid car loses a little.
          for (const [step, monthsAgo] of [2, 1, 0].entries()) {
            const electric = ELECTRIC.has(s.modelSlug);
            const hybrid = HYBRID.has(s.modelSlug);
            await db.vehicleReading.create({
              data: {
                fleetVehicleId: vehicle.id,
                at: new Date(now.getTime() - monthsAgo * 30 * DAY - DAY),
                km: s.startKm + (step + 1) * 1_100 + index * 37,
                fuelPercent: electric ? null : 35 + ((step * 17 + index * 11) % 55),
                chargePercent: electric ? 40 + ((step * 19 + index * 13) % 55) : null,
                batteryHealthPercent: electric ? 99 - step : hybrid ? 98 - step : null,
                source: "SEED",
              },
            });
            result.readings += 1;
          }
        }
      }
    }

    // The invoices of the three months before this one, made the way the administration makes them (docs/ADMIN.md §3.15): the oldest
    // is paid, the middle one is paid at every company but the first, whose is late, and the last is waiting. A month that has an
    // invoice for the company is left as it is.
    const contracts = await db.fleetContract.findMany({ where: { companyId: company.id }, include: { product: { select: { slug: true } } } });
    for (const monthsAgo of [3, 2, 1]) {
      const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1)).toISOString().slice(0, 7);
      if (await db.fleetInvoice.findFirst({ where: { companyId: company.id, period }, select: { id: true } })) continue;
      const range = periodRange(period)!;
      const lines = contracts.flatMap((c): InvoiceLine[] => {
        const line = lineOf({ number: c.number, productSlug: c.product.slug, monthlyFee: c.monthlyFee, startAt: c.startAt, endAt: c.endAt }, range);
        return line ? [line] : [];
      });
      if (lines.length === 0) continue;
      const issuedAt = addDays(range.end, 1);
      const dueAt = parseDay(dueDayOf(issuedAt))!;
      const paid = monthsAgo === 3 || (monthsAgo === 2 && seedIndex !== 0);
      const [{ serial }] = await db.$queryRaw<{ serial: bigint }[]>`SELECT nextval('"FleetInvoiceNumber_seq"') AS serial`;
      await db.fleetInvoice.create({
        data: {
          number: `FTR-${issuedAt.getUTCFullYear()}-${String(serial).padStart(5, "0")}`,
          companyId: company.id,
          period,
          issuedAt,
          dueAt,
          lines,
          ...totalsOf(lines),
          paidAt: paid ? addDays(dueAt, -5) : null,
        },
      });
      result.invoices += 1;
    }
  }
  return result;
}
