// Sample fleet for development, switched on with USE_MOCKS=1 (see lib/fleet-client.ts).
// It stands in for the backend's seed data (BACKLOG #15) until the API exists, and is
// never reached unless that variable is set. Everything here, including the exchange
// rates below, is made up.
import type { Currency, Money } from "@/lib/currency";
import { localToInstant, rentalDays, type RentalSearch } from "@/lib/rental-search";
import type { Branch, FuelType, Transmission, Vehicle, VehicleClass, VehicleOffer } from "@/lib/vehicle";

export const MOCK_BRANCHES: Branch[] = [
  { id: "istanbul-kadikoy", name: "Kadıköy", city: "İstanbul" },
  { id: "istanbul-havalimani", name: "İstanbul Havalimanı", city: "İstanbul" },
  { id: "istanbul-sabiha", name: "Sabiha Gökçen Havalimanı", city: "İstanbul" },
  { id: "ankara-esenboga", name: "Esenboğa Havalimanı", city: "Ankara" },
  { id: "ankara-kizilay", name: "Kızılay", city: "Ankara" },
  { id: "izmir-adnan-menderes", name: "Adnan Menderes Havalimanı", city: "İzmir" },
  { id: "izmir-alsancak", name: "Alsancak", city: "İzmir" },
  { id: "antalya-havalimani", name: "Antalya Havalimanı", city: "Antalya" },
  { id: "bursa-nilufer", name: "Nilüfer", city: "Bursa" },
  { id: "adana-sakirpasa", name: "Şakirpaşa Havalimanı", city: "Adana" },
  { id: "gaziantep-havalimani", name: "Oğuzeli Havalimanı", city: "Gaziantep" },
  { id: "konya-merkez", name: "Merkez", city: "Konya" },
  { id: "eskisehir-merkez", name: "Merkez", city: "Eskişehir" },
  { id: "mugla-dalaman", name: "Dalaman Havalimanı", city: "Muğla" },
  // No cars on purpose: it is how the "nothing available" states can be seen.
  { id: "trabzon-havalimani", name: "Trabzon Havalimanı", city: "Trabzon" },
];

const CLASSES: Record<string, VehicleClass> = {
  economy: { slug: "economy", name: { tr: "Ekonomik", en: "Economy" } },
  compact: { slug: "compact", name: { tr: "Orta sınıf", en: "Compact" } },
  executive: { slug: "executive", name: { tr: "Üst sınıf", en: "Executive" } },
  suv: { slug: "suv", name: { tr: "SUV", en: "SUV" } },
  electric: { slug: "electric", name: { tr: "Elektrikli", en: "Electric" } },
};

type Model = {
  slug: string;
  brand: string;
  model: string;
  class: keyof typeof CLASSES;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelType;
  dailyKurus: number;
};

const MODELS: Model[] = [
  { slug: "fiat-egea", brand: "Fiat", model: "Egea", class: "economy", seats: 5, bags: 3, transmission: "MANUAL", fuelType: "DIESEL", dailyKurus: 85000 },
  { slug: "renault-clio", brand: "Renault", model: "Clio", class: "economy", seats: 5, bags: 2, transmission: "MANUAL", fuelType: "PETROL", dailyKurus: 80000 },
  { slug: "hyundai-i20", brand: "Hyundai", model: "i20", class: "economy", seats: 5, bags: 2, transmission: "AUTOMATIC", fuelType: "PETROL", dailyKurus: 90000 },
  { slug: "toyota-corolla-hybrid", brand: "Toyota", model: "Corolla Hybrid", class: "compact", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "HYBRID", dailyKurus: 125000 },
  { slug: "renault-megane", brand: "Renault", model: "Megane", class: "compact", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "DIESEL", dailyKurus: 115000 },
  { slug: "volkswagen-passat", brand: "Volkswagen", model: "Passat", class: "executive", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", dailyKurus: 165000 },
  { slug: "mercedes-e-serisi", brand: "Mercedes-Benz", model: "E-Serisi", class: "executive", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", dailyKurus: 320000 },
  { slug: "dacia-duster", brand: "Dacia", model: "Duster", class: "suv", seats: 5, bags: 4, transmission: "MANUAL", fuelType: "DIESEL", dailyKurus: 130000 },
  { slug: "nissan-qashqai", brand: "Nissan", model: "Qashqai", class: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "PETROL", dailyKurus: 155000 },
  { slug: "toyota-rav4-hybrid", brand: "Toyota", model: "RAV4 Hybrid", class: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "HYBRID", dailyKurus: 210000 },
  { slug: "tesla-model-y", brand: "Tesla", model: "Model Y", class: "electric", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", dailyKurus: 260000 },
  { slug: "togg-t10x", brand: "Togg", model: "T10X", class: "electric", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", dailyKurus: 230000 },
];

// Four different models per stocked branch; 5 is coprime with 12, so a branch never gets
// the same model twice and the pattern still shifts from one branch to the next.
const PER_BRANCH = 4;

function buildVehicles(): Vehicle[] {
  const vehicles: Vehicle[] = [];
  MOCK_BRANCHES.forEach((branch, branchIndex) => {
    if (branch.id === "trabzon-havalimani") return;
    for (let k = 0; k < PER_BRANCH; k++) {
      const model = MODELS[(branchIndex * 3 + k * 5) % MODELS.length];
      vehicles.push({
        id: `${branch.id}__${model.slug}`,
        slug: `${model.slug}-${branch.id}`,
        brand: model.brand,
        model: model.model,
        year: 2025,
        seats: model.seats,
        bags: model.bags,
        transmission: model.transmission,
        fuelType: model.fuelType,
        dailyPrice: { amount: model.dailyKurus, currency: "TRY" },
        imageUrl: null,
        vehicleClass: CLASSES[model.class],
        branchId: branch.id,
      });
    }
  });
  return vehicles;
}

const VEHICLES = buildVehicles();

// Made-up rates (TRY per unit). The real ones live in the backend's ExchangeRate table
// (ARCHITECTURE ADR-15); the frontend never converts, only this stand-in does.
const MOCK_TRY_PER_UNIT: Record<Currency, number> = { TRY: 1, EUR: 48, USD: 41 };

export function mockConvert(money: Money, currency: Currency): Money {
  if (money.currency === currency) return money;
  const inTry = money.amount * MOCK_TRY_PER_UNIT[money.currency];
  return { amount: Math.round(inTry / MOCK_TRY_PER_UNIT[currency]), currency };
}

function inCurrency(vehicle: Vehicle, currency: Currency): Vehicle {
  return { ...vehicle, dailyPrice: mockConvert(vehicle.dailyPrice, currency) };
}

export function mockBranches(): Branch[] {
  return MOCK_BRANCHES;
}

export function mockVehicles(currency: Currency): Vehicle[] {
  return VEHICLES.map((vehicle) => inCurrency(vehicle, currency));
}

// The cars at the pick-up branch. A rental longer than 30 days finds nothing, so the
// empty state can be reached without a branch that has no cars.
export function mockAvailable(search: RentalSearch, currency: Currency): VehicleOffer[] {
  const days = rentalDays(search);
  const start = localToInstant(search.startAt);
  if (days > 30 || start.getTime() < Date.now() - 24 * 60 * 60 * 1000) return [];
  return VEHICLES.filter((vehicle) => vehicle.branchId === search.pickupBranchId).map((vehicle) => {
    const priced = inCurrency(vehicle, currency);
    return { ...priced, days, totalPrice: { amount: priced.dailyPrice.amount * days, currency } };
  });
}
