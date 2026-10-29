// Seed verisi. Kurgusal; rakamlar SPEC §4.1, içerik SPEC Ek A'dan.
// Bu dosya Prisma'dan bağımsızdır: yalnızca veri ve küçük yardımcılar içerir.

export type L = { tr: string; en: string };
export type Transmission = "MANUAL" | "AUTOMATIC";
export type FuelType = "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC";
export type ConsumptionUnit = "L_PER_100KM" | "KWH_PER_100KM";

// Sabit UUID'ler: seed tekrar çalışınca aynı kayıtlar güncellenir, çift kayıt oluşmaz.
// kind: 1 sınıf, 2 bayi, 3 model (6 SSS'ydi; SSS artık web'in çeviri dosyalarında)
export const uid = (kind: number, n: number): string =>
  `00000000-0000-4000-8000-${kind.toString(16).padStart(4, "0")}${n.toString(16).padStart(8, "0")}`;

// ---------- Araç sınıfları (ucuzdan pahalıya) ----------

export const classes = [
  { id: uid(1, 1), slug: "ekonomik", nameTr: "Ekonomik", nameEn: "Economy" },
  { id: uid(1, 2), slug: "orta-sinif", nameTr: "Orta sınıf", nameEn: "Mid-size" },
  { id: uid(1, 3), slug: "suv", nameTr: "SUV", nameEn: "SUV" },
  { id: uid(1, 4), slug: "elektrikli", nameTr: "Elektrikli", nameEn: "Electric" },
  { id: uid(1, 5), slug: "premium", nameTr: "Premium", nameEn: "Premium" },
];

// ---------- Bayiler: 14 şehirde 15 bayi (İstanbul'da 2) ----------

type Hours = { weekdays: string; saturday: string; sunday: string };
const std: Hours = { weekdays: "08:30-19:00", saturday: "09:00-17:00", sunday: "closed" };
const airport: Hours = { weekdays: "07:00-23:00", saturday: "07:00-23:00", sunday: "07:00-23:00" };
const city: Hours = { weekdays: "08:30-19:00", saturday: "09:00-17:00", sunday: "10:00-16:00" };

export const branches = [
  { key: "ist-ihl", id: uid(2, 1), plateCode: "34", large: true, name: "İstanbul Havalimanı", city: "İstanbul", address: "Dış Hatlar Gelen Yolcu Katı, Arnavutköy", latitude: 41.2753, longitude: 28.7519, phone: "+90 212 555 01 01", email: "istanbul-havalimani@novera.example", openingHours: airport },
  { key: "ist-kdk", id: uid(2, 2), plateCode: "34", large: false, name: "İstanbul Kadıköy", city: "İstanbul", address: "Caferağa Mahallesi, Kadıköy", latitude: 40.9903, longitude: 29.029, phone: "+90 216 555 01 02", email: "istanbul-kadikoy@novera.example", openingHours: city },
  { key: "ank", id: uid(2, 3), plateCode: "06", large: true, name: "Ankara Çankaya", city: "Ankara", address: "Kızılay Mahallesi, Çankaya", latitude: 39.9179, longitude: 32.8627, phone: "+90 312 555 01 03", email: "ankara@novera.example", openingHours: city },
  { key: "izm", id: uid(2, 4), plateCode: "35", large: true, name: "İzmir Adnan Menderes Havalimanı", city: "İzmir", address: "Dış Hatlar Gelen Yolcu Katı, Gaziemir", latitude: 38.2924, longitude: 27.157, phone: "+90 232 555 01 04", email: "izmir@novera.example", openingHours: airport },
  { key: "ayt", id: uid(2, 5), plateCode: "07", large: true, name: "Antalya Havalimanı", city: "Antalya", address: "Dış Hatlar Gelen Yolcu Katı, Muratpaşa", latitude: 36.8987, longitude: 30.8005, phone: "+90 242 555 01 05", email: "antalya@novera.example", openingHours: airport },
  { key: "brs", id: uid(2, 6), plateCode: "16", large: false, name: "Bursa Nilüfer", city: "Bursa", address: "Özlüce Mahallesi, Nilüfer", latitude: 40.2144, longitude: 28.9344, phone: "+90 224 555 01 06", email: "bursa@novera.example", openingHours: city },
  { key: "adn", id: uid(2, 7), plateCode: "01", large: false, name: "Adana Seyhan", city: "Adana", address: "Reşatbey Mahallesi, Seyhan", latitude: 36.9914, longitude: 35.3308, phone: "+90 322 555 01 07", email: "adana@novera.example", openingHours: city },
  { key: "gzt", id: uid(2, 8), plateCode: "27", large: false, name: "Gaziantep Şahinbey", city: "Gaziantep", address: "Karataş Mahallesi, Şahinbey", latitude: 37.0662, longitude: 37.3833, phone: "+90 342 555 01 08", email: "gaziantep@novera.example", openingHours: city },
  { key: "kny", id: uid(2, 9), plateCode: "42", large: false, name: "Konya Selçuklu", city: "Konya", address: "Yazır Mahallesi, Selçuklu", latitude: 37.8715, longitude: 32.4846, phone: "+90 332 555 01 09", email: "konya@novera.example", openingHours: std },
  { key: "kys", id: uid(2, 10), plateCode: "38", large: false, name: "Kayseri Melikgazi", city: "Kayseri", address: "Esenyurt Mahallesi, Melikgazi", latitude: 38.7312, longitude: 35.4787, phone: "+90 352 555 01 10", email: "kayseri@novera.example", openingHours: std },
  { key: "trb", id: uid(2, 11), plateCode: "61", large: false, name: "Trabzon Ortahisar", city: "Trabzon", address: "Pelitli Mahallesi, Ortahisar", latitude: 41.0027, longitude: 39.7168, phone: "+90 462 555 01 11", email: "trabzon@novera.example", openingHours: city },
  { key: "esk", id: uid(2, 12), plateCode: "26", large: false, name: "Eskişehir Tepebaşı", city: "Eskişehir", address: "Hoşnudiye Mahallesi, Tepebaşı", latitude: 39.7667, longitude: 30.5256, phone: "+90 222 555 01 12", email: "eskisehir@novera.example", openingHours: std },
  { key: "mug", id: uid(2, 13), plateCode: "48", large: false, name: "Muğla Bodrum Havalimanı", city: "Muğla", address: "Dış Hatlar Gelen Yolcu Katı, Milas", latitude: 37.2506, longitude: 27.6643, phone: "+90 252 555 01 13", email: "mugla@novera.example", openingHours: airport },
  { key: "sms", id: uid(2, 14), plateCode: "55", large: false, name: "Samsun İlkadım", city: "Samsun", address: "Kale Mahallesi, İlkadım", latitude: 41.2867, longitude: 36.33, phone: "+90 362 555 01 14", email: "samsun@novera.example", openingHours: city },
  { key: "dyr", id: uid(2, 15), plateCode: "21", large: false, name: "Diyarbakır Yenişehir", city: "Diyarbakır", address: "Bağcılar Mahallesi, Yenişehir", latitude: 37.9144, longitude: 40.2306, phone: "+90 412 555 01 15", email: "diyarbakir@novera.example", openingHours: std },
];

// ---------- Araç modelleri: 15 model, her biri 1-4 bayide ----------
// dailyPrice: TRY, kuruş cinsinden (₺1.250 = 125000). Değerler örnektir.

export type ModelSeed = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  classSlug: string;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelType;
  consumption: number;
  consumptionUnit: ConsumptionUnit;
  dailyPrice: number;
  description: L;
  branchKeys: string[];
};

// Fotoğraflar web uygulamasının `public/fleet` klasöründe durur (apps/web/public/fleet/<dosya>.webp);
// `imageUrl` web sitesine göre yoldur. Dosyası olmayan modelde `null` kalır ve web yer tutucu gösterir (şu an 15 modelin hepsinin fotoğrafı var).
// Yeni bir fotoğraf eklenince buraya da satır eklenir ve `pnpm db:seed` yeniden çalıştırılır.
export const modelImages: Record<string, string> = {
  "fiat-egea": "/fleet/fiat-egea.webp",
  "renault-clio": "/fleet/renault-clio.webp",
  "hyundai-i20": "/fleet/hyundai-i20.webp",
  "toyota-corolla-hybrid": "/fleet/toyota-corolla-hybrid.webp",
  "renault-megane-sedan": "/fleet/renault-megane.webp",
  "nissan-qashqai": "/fleet/nissan-qashqai.webp",
  "dacia-duster": "/fleet/dacia-duster.webp",
  "togg-t10x": "/fleet/togg-t10x.webp",
  "tesla-model-y": "/fleet/tesla-model-y.webp",
  "bmw-5-serisi": "/fleet/bmw-5-serisi.webp",
  "mercedes-e-serisi": "/fleet/mercedes-e-serisi.webp",
  "volkswagen-passat": "/fleet/volkswagen-passat.webp",
  "toyota-rav4-hybrid": "/fleet/toyota-rav4-hybrid.webp",
  "hyundai-ioniq-5": "/fleet/hyundai-ioniq-5.webp",
  "peugeot-3008": "/fleet/peugeot-3008.webp",
};

// Seed'de bir zamanlar olup belgelerde hiç olmayan modeller (V2-21): yerlerine passat, rav4, ioniq-5 ve 3008 geldi.
// Bu dört modelin plakaları yeni modellere geçer; seed yalnızca artık hiç aracı kalmamış olanları siler.
export const retiredModelSlugs = ["volkswagen-golf", "hyundai-tucson", "volkswagen-id4", "audi-a6"];

export const models: ModelSeed[] = [
  { id: uid(3, 1), slug: "fiat-egea", brand: "Fiat", model: "Egea", classSlug: "ekonomik", seats: 5, bags: 3, transmission: "MANUAL", fuelType: "PETROL", consumption: 6.1, consumptionUnit: "L_PER_100KM", dailyPrice: 125000, description: { tr: "Geniş bagajı ve sade kullanımıyla şehir içi ve uzun yol için pratik sedan.", en: "A practical sedan with a roomy boot, easy for the city and the open road." }, branchKeys: ["ist-ihl", "ank", "izm", "adn"] },
  { id: uid(3, 2), slug: "renault-clio", brand: "Renault", model: "Clio", classSlug: "ekonomik", seats: 5, bags: 2, transmission: "MANUAL", fuelType: "PETROL", consumption: 5.4, consumptionUnit: "L_PER_100KM", dailyPrice: 115000, description: { tr: "Kompakt boyutu ve düşük tüketimiyle şehir içinde park etmesi kolay.", en: "Compact and frugal, easy to park in town." }, branchKeys: ["ist-kdk", "brs", "esk", "sms"] },
  { id: uid(3, 3), slug: "hyundai-i20", brand: "Hyundai", model: "i20", classSlug: "ekonomik", seats: 5, bags: 2, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: 5.6, consumptionUnit: "L_PER_100KM", dailyPrice: 135000, description: { tr: "Otomatik vitesli, çevik ve ekonomik bir şehir aracı.", en: "An agile, economical automatic city car." }, branchKeys: ["izm", "ayt", "mug"] },
  { id: uid(3, 4), slug: "toyota-corolla-hybrid", brand: "Toyota", model: "Corolla Hybrid", classSlug: "orta-sinif", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "HYBRID", consumption: 4.5, consumptionUnit: "L_PER_100KM", dailyPrice: 195000, description: { tr: "Hibrit motoruyla düşük tüketim ve sessiz sürüş bir arada.", en: "Low consumption and a quiet ride from its hybrid engine." }, branchKeys: ["ist-ihl", "ank", "ayt", "kny"] },
  { id: uid(3, 16), slug: "volkswagen-passat", brand: "Volkswagen", model: "Passat", classSlug: "orta-sinif", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: 5.6, consumptionUnit: "L_PER_100KM", dailyPrice: 230000, description: { tr: "Geniş bagajı ve konforlu koltuklarıyla uzun mesafe ve iş seyahatleri için üst sınıf bir sedan.", en: "An executive saloon with a large boot and comfortable seats, made for long distances and business travel." }, branchKeys: ["ist-kdk", "izm", "brs", "dyr"] },
  { id: uid(3, 6), slug: "renault-megane-sedan", brand: "Renault", model: "Megane Sedan", classSlug: "orta-sinif", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: 4.8, consumptionUnit: "L_PER_100KM", dailyPrice: 185000, description: { tr: "Dizel motoru ve geniş bagajıyla uzun yollar için rahat bir sedan.", en: "A comfortable diesel sedan with a large boot for long journeys." }, branchKeys: ["ank", "gzt", "kys", "dyr"] },
  { id: uid(3, 7), slug: "nissan-qashqai", brand: "Nissan", model: "Qashqai", classSlug: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "HYBRID", consumption: 5.3, consumptionUnit: "L_PER_100KM", dailyPrice: 260000, description: { tr: "Yüksek oturuşlu, hibrit ve geniş: aile ve tatil için dengeli bir SUV.", en: "A balanced hybrid SUV for family trips and holidays." }, branchKeys: ["ist-ihl", "ayt", "trb", "sms"] },
  { id: uid(3, 17), slug: "toyota-rav4-hybrid", brand: "Toyota", model: "RAV4 Hybrid", classSlug: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "HYBRID", consumption: 5.1, consumptionUnit: "L_PER_100KM", dailyPrice: 300000, description: { tr: "Hibrit motoru ve geniş bagajıyla uzun yolda da şehirde de ekonomik, rahat bir SUV.", en: "A comfortable SUV that stays economical in the city and on the road thanks to its hybrid engine and large boot." }, branchKeys: ["ank", "izm", "kys"] },
  { id: uid(3, 9), slug: "dacia-duster", brand: "Dacia", model: "Duster", classSlug: "suv", seats: 5, bags: 4, transmission: "MANUAL", fuelType: "PETROL", consumption: 6.5, consumptionUnit: "L_PER_100KM", dailyPrice: 210000, description: { tr: "Sağlam yapısıyla bozuk yolda da rahat eden uygun fiyatlı SUV.", en: "A sturdy, affordable SUV that handles rough roads." }, branchKeys: ["adn", "gzt", "kny", "trb"] },
  { id: uid(3, 10), slug: "togg-t10x", brand: "Togg", model: "T10X", classSlug: "elektrikli", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: 17.5, consumptionUnit: "KWH_PER_100KM", dailyPrice: 360000, description: { tr: "Yerli üretim elektrikli SUV; sessiz, hızlı ve şehir içinde ekonomik.", en: "A home-grown electric SUV, quiet, quick and cheap to run in town." }, branchKeys: ["ist-kdk", "ank", "brs", "esk"] },
  { id: uid(3, 18), slug: "hyundai-ioniq-5", brand: "Hyundai", model: "Ioniq 5", classSlug: "elektrikli", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: 17.5, consumptionUnit: "KWH_PER_100KM", dailyPrice: 395000, description: { tr: "Hızlı şarj desteği ve ferah kabiniyle uzun yola da çıkabilen, tamamen elektrikli bir crossover.", en: "A fully electric crossover with fast-charging support and an airy cabin, able to take on long trips." }, branchKeys: ["ist-ihl", "ayt"] },
  { id: uid(3, 12), slug: "tesla-model-y", brand: "Tesla", model: "Model Y", classSlug: "elektrikli", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: 16, consumptionUnit: "KWH_PER_100KM", dailyPrice: 420000, description: { tr: "Yüksek performans ve geniş bagaj hacmiyle öne çıkan elektrikli SUV.", en: "An electric SUV known for performance and a large load space." }, branchKeys: ["ist-ihl", "ank", "izm"] },
  { id: uid(3, 13), slug: "bmw-5-serisi", brand: "BMW", model: "5 Serisi", classSlug: "premium", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: 7, consumptionUnit: "L_PER_100KM", dailyPrice: 520000, description: { tr: "Yönetici sınıfı konfor ve sürüş keyfini birleştiren prestij sedan.", en: "An executive saloon that combines comfort with driving pleasure." }, branchKeys: ["ist-ihl", "ank"] },
  { id: uid(3, 14), slug: "mercedes-e-serisi", brand: "Mercedes-Benz", model: "E Serisi", classSlug: "premium", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: 7.2, consumptionUnit: "L_PER_100KM", dailyPrice: 560000, description: { tr: "Arka koltuk konforuyla yönetici ve konuk transferlerinin tercihi.", en: "A favourite for executive and guest transfers thanks to rear-seat comfort." }, branchKeys: ["ist-ihl", "izm"] },
  { id: uid(3, 19), slug: "peugeot-3008", brand: "Peugeot", model: "3008", classSlug: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: 5.9, consumptionUnit: "L_PER_100KM", dailyPrice: 280000, description: { tr: "Şık iç tasarımı ve dizel motoruyla uzun yolculuklar için konforlu bir SUV.", en: "A comfortable SUV for long journeys, with a stylish interior and a diesel engine." }, branchKeys: ["ist-kdk", "ayt", "mug"] },
];

export type VehicleSeed = { plate: string; year: number; modelSlug: string; branchKey: string };

// Her model-bayi çifti için fiziksel araç: büyük bayilerde 2, diğerlerinde 1.
export function buildVehicles(): VehicleSeed[] {
  const out: VehicleSeed[] = [];
  let seq = 1001;
  for (const m of models) {
    for (const key of m.branchKeys) {
      const b = branches.find((x) => x.key === key);
      if (!b) throw new Error(`Bilinmeyen bayi: ${key}`);
      const count = b.large ? 2 : 1;
      for (let i = 0; i < count; i++) {
        out.push({ plate: `${b.plateCode} NV ${seq}`, year: 2025 + ((seq + i) % 2), modelSlug: m.slug, branchKey: key });
        seq++;
      }
    }
  }
  return out;
}

// ---------- Ek hizmetler ----------
// price: TRY, kuruş. PER_DAY günlük, FIXED tek seferlik.

export const extras = [
  { slug: "cocuk-koltugu", nameTr: "Çocuk koltuğu", nameEn: "Child seat", price: 12000, pricing: "PER_DAY" as const },
  { slug: "ek-surucu", nameTr: "Ek sürücü", nameEn: "Additional driver", price: 35000, pricing: "FIXED" as const },
  { slug: "mobil-wifi", nameTr: "Mobil Wi-Fi", nameEn: "Mobile Wi-Fi", price: 9000, pricing: "PER_DAY" as const },
  { slug: "otoyol-gecis-paketi", nameTr: "Otoyol ve köprü geçiş paketi", nameEn: "Motorway and bridge toll pass", price: 25000, pricing: "FIXED" as const },
];

// ---------- Kurlar ----------
// ÖRNEK değerler, güncel kur değildir. Günlük güncelleme görevi gelince (BACKLOG Y1) üzerine yazılır.
// ratePerTry: 1 TRY kaç birim ediyor.

export const rates = [
  { currency: "TRY" as const, ratePerTry: "1" },
  { currency: "EUR" as const, ratePerTry: "0.0200" },
  { currency: "USD" as const, ratePerTry: "0.0230" },
];

// ---------- Ürünler ----------

// Yalnızca slug: metinler web'in çeviri dosyalarında (ADR-32). Liste `apps/web/lib/products.ts` ile aynı olmalı;
// kurumsal teklif formu ürünü slug ile seçer ve API `QuoteRequest.productId`'yi buradan bulur.
export const products = [
  { slug: "akilli-kurumsal-filo" },
  { slug: "vip-mobilite" },
  { slug: "esnek-kisa-donem" },
  { slug: "yesil-filo" },
];

// Kampanya kodları (SPEC §2.3, kurgusal). Yüzde, araç ve ek hizmetlerin toplamından düşer.
export const promoCodes = [
  { code: "NOVERA10", percent: 10 },
  { code: "HOSGELDIN", percent: 5 },
];
