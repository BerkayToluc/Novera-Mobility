// Sample fleet for development, switched on with USE_MOCKS=1 (see lib/fleet-client.ts).
// It stands in for the backend's seed data (BACKLOG #15) until the API exists, and is
// never reached unless that variable is set. Everything here, including the exchange
// rates below, is made up. The counts follow SPEC §4.1: 15 branches in 14 cities
// (Istanbul has two) and 15 car models, each in one to four branches.
import type { Currency, Money } from "@/lib/currency";
import { localToInstant, rentalDays, type RentalSearch } from "@/lib/rental-search";
import type {
  Branch,
  Consumption,
  FuelType,
  Transmission,
  Vehicle,
  VehicleClass,
  VehicleOffer,
} from "@/lib/vehicle";

export const MOCK_BRANCHES: Branch[] = [
  { id: "istanbul-kadikoy", name: "Kadıköy", city: "İstanbul" },
  { id: "istanbul-havalimani", name: "İstanbul Havalimanı", city: "İstanbul" },
  { id: "ankara-esenboga", name: "Esenboğa Havalimanı", city: "Ankara" },
  { id: "izmir-adnan-menderes", name: "Adnan Menderes Havalimanı", city: "İzmir" },
  { id: "antalya-havalimani", name: "Antalya Havalimanı", city: "Antalya" },
  { id: "bursa-nilufer", name: "Nilüfer", city: "Bursa" },
  { id: "adana-sakirpasa", name: "Şakirpaşa Havalimanı", city: "Adana" },
  { id: "gaziantep-havalimani", name: "Oğuzeli Havalimanı", city: "Gaziantep" },
  { id: "konya-merkez", name: "Merkez", city: "Konya" },
  { id: "eskisehir-merkez", name: "Merkez", city: "Eskişehir" },
  { id: "mugla-dalaman", name: "Dalaman Havalimanı", city: "Muğla" },
  { id: "kayseri-havalimani", name: "Erkilet Havalimanı", city: "Kayseri" },
  { id: "samsun-havalimani", name: "Çarşamba Havalimanı", city: "Samsun" },
  { id: "diyarbakir-merkez", name: "Merkez", city: "Diyarbakır" },
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

const litres = (value: number): Consumption => ({ value, unit: "L_PER_100KM" });
const kwh = (value: number): Consumption => ({ value, unit: "KWH_PER_100KM" });

type Model = {
  slug: string;
  brand: string;
  model: string;
  class: keyof typeof CLASSES;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelType;
  consumption: Consumption;
  dailyKurus: number;
  // The branches that stock it: one to four (SPEC §4.1). Bigger cities and airports hold more.
  branches: string[];
};

const MODELS: Model[] = [
  { slug: "fiat-egea", brand: "Fiat", model: "Egea", class: "economy", seats: 5, bags: 3, transmission: "MANUAL", fuelType: "DIESEL", consumption: litres(4.8), dailyKurus: 85000, branches: ["istanbul-kadikoy", "ankara-esenboga", "bursa-nilufer", "konya-merkez"] },
  { slug: "renault-clio", brand: "Renault", model: "Clio", class: "economy", seats: 5, bags: 2, transmission: "MANUAL", fuelType: "PETROL", consumption: litres(5.2), dailyKurus: 80000, branches: ["istanbul-kadikoy", "adana-sakirpasa", "eskisehir-merkez", "samsun-havalimani"] },
  { slug: "hyundai-i20", brand: "Hyundai", model: "i20", class: "economy", seats: 5, bags: 2, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: litres(5.4), dailyKurus: 90000, branches: ["izmir-adnan-menderes", "antalya-havalimani", "gaziantep-havalimani", "kayseri-havalimani"] },
  { slug: "toyota-corolla-hybrid", brand: "Toyota", model: "Corolla Hybrid", class: "compact", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "HYBRID", consumption: litres(4.5), dailyKurus: 125000, branches: ["istanbul-kadikoy", "istanbul-havalimani", "ankara-esenboga", "izmir-adnan-menderes"] },
  { slug: "renault-megane", brand: "Renault", model: "Megane", class: "compact", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: litres(4.9), dailyKurus: 115000, branches: ["bursa-nilufer", "konya-merkez", "eskisehir-merkez", "diyarbakir-merkez"] },
  { slug: "volkswagen-passat", brand: "Volkswagen", model: "Passat", class: "executive", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: litres(5.6), dailyKurus: 165000, branches: ["istanbul-havalimani", "ankara-esenboga", "adana-sakirpasa", "kayseri-havalimani"] },
  { slug: "mercedes-e-serisi", brand: "Mercedes-Benz", model: "E-Serisi", class: "executive", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: litres(6.5), dailyKurus: 320000, branches: ["istanbul-havalimani", "antalya-havalimani"] },
  { slug: "bmw-5-serisi", brand: "BMW", model: "5 Serisi", class: "executive", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: litres(6.2), dailyKurus: 305000, branches: ["istanbul-kadikoy", "izmir-adnan-menderes"] },
  { slug: "dacia-duster", brand: "Dacia", model: "Duster", class: "suv", seats: 5, bags: 4, transmission: "MANUAL", fuelType: "DIESEL", consumption: litres(5.8), dailyKurus: 130000, branches: ["antalya-havalimani", "mugla-dalaman", "samsun-havalimani", "diyarbakir-merkez"] },
  { slug: "nissan-qashqai", brand: "Nissan", model: "Qashqai", class: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: litres(6.3), dailyKurus: 155000, branches: ["istanbul-kadikoy", "bursa-nilufer", "gaziantep-havalimani", "kayseri-havalimani"] },
  { slug: "toyota-rav4-hybrid", brand: "Toyota", model: "RAV4 Hybrid", class: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "HYBRID", consumption: litres(5.1), dailyKurus: 210000, branches: ["istanbul-havalimani", "izmir-adnan-menderes", "adana-sakirpasa"] },
  { slug: "peugeot-3008", brand: "Peugeot", model: "3008", class: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: litres(5.9), dailyKurus: 175000, branches: ["ankara-esenboga", "konya-merkez", "mugla-dalaman"] },
  { slug: "tesla-model-y", brand: "Tesla", model: "Model Y", class: "electric", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: kwh(15.5), dailyKurus: 260000, branches: ["istanbul-kadikoy", "istanbul-havalimani", "izmir-adnan-menderes"] },
  { slug: "togg-t10x", brand: "Togg", model: "T10X", class: "electric", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: kwh(18), dailyKurus: 230000, branches: ["ankara-esenboga", "bursa-nilufer", "eskisehir-merkez", "antalya-havalimani"] },
  { slug: "hyundai-ioniq-5", brand: "Hyundai", model: "Ioniq 5", class: "electric", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: kwh(17.5), dailyKurus: 245000, branches: ["istanbul-havalimani", "ankara-esenboga"] },
];

// Short descriptions shown in the fleet dialog (SPEC §2.4); the real ones come from the API.
const DESCRIPTIONS: Record<string, { tr: string; en: string }> = {
  "fiat-egea": { tr: "Şehir içinde ve uzun yolda rahat, geniş bagajlı ve ekonomik bir sedan. İlk kiralama için sakin bir seçim.", en: "A comfortable, economical saloon with a roomy boot, equally at home in town and on long drives." },
  "renault-clio": { tr: "Dar sokaklarda park etmesi kolay, az yakan küçük bir hatchback. Kısa gezilerin pratik arkadaşı.", en: "A small hatchback that is easy to park in tight streets and light on fuel. A practical companion for short trips." },
  "hyundai-i20": { tr: "Otomatik vitesli ve sürmesi kolay bir şehir aracı; yoğun trafikte yorulmadan ilerlemek isteyenler için.", en: "An easy-to-drive automatic city car for anyone who wants to get through heavy traffic without the fatigue." },
  "toyota-corolla-hybrid": { tr: "Hibrit motoruyla düşük tüketim ve sessiz sürüş sunan orta sınıf bir sedan; hem iş hem tatil yolculuklarına uygun.", en: "A compact saloon whose hybrid engine means low consumption and a quiet ride, suited to business trips and holidays alike." },
  "renault-megane": { tr: "Geniş iç hacmi ve dizel motoruyla uzun yolda ekonomik giden dengeli bir orta sınıf araç.", en: "A balanced compact car with a spacious cabin and a diesel engine that stays economical on long journeys." },
  "volkswagen-passat": { tr: "Geniş bagajı ve konforlu koltuklarıyla uzun mesafe ve iş seyahatleri için üst sınıf bir sedan.", en: "An executive saloon with a large boot and comfortable seats, made for long distances and business travel." },
  "mercedes-e-serisi": { tr: "Yönetici ve konuk taşımacılığı için tam donanımlı, sessiz ve prestijli bir üst sınıf sedan.", en: "A fully equipped, quiet and prestigious executive saloon for carrying managers and guests." },
  "bmw-5-serisi": { tr: "Sürüş keyfi ve iç mekân kalitesini bir araya getiren, tam donanımlı üst sınıf bir sedan.", en: "A fully equipped executive saloon that pairs driving pleasure with a high-quality interior." },
  "dacia-duster": { tr: "Yüksek sürüş konumu ve sağlam yapısıyla bozuk yollarda da rahat eden, uygun fiyatlı bir SUV.", en: "An affordable SUV whose high driving position and sturdy build cope well even on rough roads." },
  "nissan-qashqai": { tr: "Aile yolculukları için geniş iç hacim ve otomatik vitesi bir arada sunan şehir SUV'u.", en: "A city SUV combining a spacious cabin with an automatic gearbox for family journeys." },
  "toyota-rav4-hybrid": { tr: "Hibrit motoru ve geniş bagajıyla uzun yolda da şehirde de ekonomik, rahat bir SUV.", en: "A comfortable SUV that stays economical in the city and on the road thanks to its hybrid engine and large boot." },
  "peugeot-3008": { tr: "Şık iç tasarımı ve dizel motoruyla uzun yolculuklar için konforlu bir SUV.", en: "A comfortable SUV for long journeys, with a stylish interior and a diesel engine." },
  "tesla-model-y": { tr: "Tamamen elektrikli, hızlı ve sessiz; geniş bagajıyla aile yolculuklarına da uygun bir SUV.", en: "A fully electric, quick and quiet SUV whose large boot also suits family trips." },
  "togg-t10x": { tr: "Yerli üretim, tamamen elektrikli bir SUV; sessiz sürüş ve geniş iç hacim.", en: "A domestically built, fully electric SUV with a quiet ride and a spacious cabin." },
  "hyundai-ioniq-5": { tr: "Hızlı şarj desteği ve ferah kabiniyle uzun yola da çıkabilen, tamamen elektrikli bir crossover.", en: "A fully electric crossover with fast-charging support and an airy cabin, able to take on long trips." },
};

function buildVehicles(): Vehicle[] {
  const vehicles: Vehicle[] = [];
  for (const model of MODELS) {
    for (const branchId of model.branches) {
      vehicles.push({
        id: `${branchId}__${model.slug}`,
        slug: `${model.slug}-${branchId}`,
        modelSlug: model.slug,
        brand: model.brand,
        model: model.model,
        year: 2025,
        seats: model.seats,
        bags: model.bags,
        transmission: model.transmission,
        fuelType: model.fuelType,
        consumption: model.consumption,
        description: DESCRIPTIONS[model.slug],
        dailyPrice: { amount: model.dailyKurus, currency: "TRY" },
        imageUrl: null,
        vehicleClass: CLASSES[model.class],
        branchId,
      });
    }
  }
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
