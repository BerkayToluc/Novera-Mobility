// Seed verisi. Kurgusal; rakamlar SPEC §4.1, içerik SPEC Ek A'dan.
// Bu dosya Prisma'dan bağımsızdır: yalnızca veri ve küçük yardımcılar içerir.

export type L = { tr: string; en: string };
export type LL = { tr: string[]; en: string[] };
export type Transmission = "MANUAL" | "AUTOMATIC";
export type FuelType = "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC";
export type ConsumptionUnit = "L_PER_100KM" | "KWH_PER_100KM";

// Sabit UUID'ler: seed tekrar çalışınca aynı kayıtlar güncellenir, çift kayıt oluşmaz.
// kind: 1 sınıf, 2 bayi, 3 model, 6 SSS
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
// `imageUrl` web sitesine göre yoldur. Dosyası olmayan modelde `null` kalır ve web yer tutucu gösterir.
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
};

export const models: ModelSeed[] = [
  { id: uid(3, 1), slug: "fiat-egea", brand: "Fiat", model: "Egea", classSlug: "ekonomik", seats: 5, bags: 3, transmission: "MANUAL", fuelType: "PETROL", consumption: 6.1, consumptionUnit: "L_PER_100KM", dailyPrice: 125000, description: { tr: "Geniş bagajı ve sade kullanımıyla şehir içi ve uzun yol için pratik sedan.", en: "A practical sedan with a roomy boot, easy for the city and the open road." }, branchKeys: ["ist-ihl", "ank", "izm", "adn"] },
  { id: uid(3, 2), slug: "renault-clio", brand: "Renault", model: "Clio", classSlug: "ekonomik", seats: 5, bags: 2, transmission: "MANUAL", fuelType: "PETROL", consumption: 5.4, consumptionUnit: "L_PER_100KM", dailyPrice: 115000, description: { tr: "Kompakt boyutu ve düşük tüketimiyle şehir içinde park etmesi kolay.", en: "Compact and frugal, easy to park in town." }, branchKeys: ["ist-kdk", "brs", "esk", "sms"] },
  { id: uid(3, 3), slug: "hyundai-i20", brand: "Hyundai", model: "i20", classSlug: "ekonomik", seats: 5, bags: 2, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: 5.6, consumptionUnit: "L_PER_100KM", dailyPrice: 135000, description: { tr: "Otomatik vitesli, çevik ve ekonomik bir şehir aracı.", en: "An agile, economical automatic city car." }, branchKeys: ["izm", "ayt", "mug"] },
  { id: uid(3, 4), slug: "toyota-corolla-hybrid", brand: "Toyota", model: "Corolla Hybrid", classSlug: "orta-sinif", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "HYBRID", consumption: 4.5, consumptionUnit: "L_PER_100KM", dailyPrice: 195000, description: { tr: "Hibrit motoruyla düşük tüketim ve sessiz sürüş bir arada.", en: "Low consumption and a quiet ride from its hybrid engine." }, branchKeys: ["ist-ihl", "ank", "ayt", "kny"] },
  { id: uid(3, 5), slug: "volkswagen-golf", brand: "Volkswagen", model: "Golf", classSlug: "orta-sinif", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: 5.8, consumptionUnit: "L_PER_100KM", dailyPrice: 190000, description: { tr: "Dengeli sürüşü ve geniş iç hacmiyle orta sınıfın referans modeli.", en: "A balanced drive and plenty of space, the mid-size benchmark." }, branchKeys: ["ist-kdk", "izm", "brs", "dyr"] },
  { id: uid(3, 6), slug: "renault-megane-sedan", brand: "Renault", model: "Megane Sedan", classSlug: "orta-sinif", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: 4.8, consumptionUnit: "L_PER_100KM", dailyPrice: 185000, description: { tr: "Dizel motoru ve geniş bagajıyla uzun yollar için rahat bir sedan.", en: "A comfortable diesel sedan with a large boot for long journeys." }, branchKeys: ["ank", "gzt", "kys", "dyr"] },
  { id: uid(3, 7), slug: "nissan-qashqai", brand: "Nissan", model: "Qashqai", classSlug: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "HYBRID", consumption: 5.3, consumptionUnit: "L_PER_100KM", dailyPrice: 260000, description: { tr: "Yüksek oturuşlu, hibrit ve geniş: aile ve tatil için dengeli bir SUV.", en: "A balanced hybrid SUV for family trips and holidays." }, branchKeys: ["ist-ihl", "ayt", "trb", "sms"] },
  { id: uid(3, 8), slug: "hyundai-tucson", brand: "Hyundai", model: "Tucson", classSlug: "suv", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: 6.2, consumptionUnit: "L_PER_100KM", dailyPrice: 290000, description: { tr: "Geniş iç mekân ve güçlü dizel motor, uzun yolda konforlu.", en: "A spacious cabin and a strong diesel engine, comfortable on long drives." }, branchKeys: ["ank", "izm", "kys"] },
  { id: uid(3, 9), slug: "dacia-duster", brand: "Dacia", model: "Duster", classSlug: "suv", seats: 5, bags: 4, transmission: "MANUAL", fuelType: "PETROL", consumption: 6.5, consumptionUnit: "L_PER_100KM", dailyPrice: 210000, description: { tr: "Sağlam yapısıyla bozuk yolda da rahat eden uygun fiyatlı SUV.", en: "A sturdy, affordable SUV that handles rough roads." }, branchKeys: ["adn", "gzt", "kny", "trb"] },
  { id: uid(3, 10), slug: "togg-t10x", brand: "Togg", model: "T10X", classSlug: "elektrikli", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: 17.5, consumptionUnit: "KWH_PER_100KM", dailyPrice: 360000, description: { tr: "Yerli üretim elektrikli SUV; sessiz, hızlı ve şehir içinde ekonomik.", en: "A home-grown electric SUV, quiet, quick and cheap to run in town." }, branchKeys: ["ist-kdk", "ank", "brs", "esk"] },
  { id: uid(3, 11), slug: "volkswagen-id4", brand: "Volkswagen", model: "ID.4", classSlug: "elektrikli", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: 17, consumptionUnit: "KWH_PER_100KM", dailyPrice: 390000, description: { tr: "Geniş iç hacmi ve sakin sürüşüyle uzun menzilli elektrikli SUV.", en: "A long-range electric SUV with a roomy cabin and a calm ride." }, branchKeys: ["ist-ihl", "ayt"] },
  { id: uid(3, 12), slug: "tesla-model-y", brand: "Tesla", model: "Model Y", classSlug: "elektrikli", seats: 5, bags: 4, transmission: "AUTOMATIC", fuelType: "ELECTRIC", consumption: 16, consumptionUnit: "KWH_PER_100KM", dailyPrice: 420000, description: { tr: "Yüksek performans ve geniş bagaj hacmiyle öne çıkan elektrikli SUV.", en: "An electric SUV known for performance and a large load space." }, branchKeys: ["ist-ihl", "ank", "izm"] },
  { id: uid(3, 13), slug: "bmw-5-serisi", brand: "BMW", model: "5 Serisi", classSlug: "premium", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: 7, consumptionUnit: "L_PER_100KM", dailyPrice: 520000, description: { tr: "Yönetici sınıfı konfor ve sürüş keyfini birleştiren prestij sedan.", en: "An executive saloon that combines comfort with driving pleasure." }, branchKeys: ["ist-ihl", "ank"] },
  { id: uid(3, 14), slug: "mercedes-e-serisi", brand: "Mercedes-Benz", model: "E Serisi", classSlug: "premium", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "PETROL", consumption: 7.2, consumptionUnit: "L_PER_100KM", dailyPrice: 560000, description: { tr: "Arka koltuk konforuyla yönetici ve konuk transferlerinin tercihi.", en: "A favourite for executive and guest transfers thanks to rear-seat comfort." }, branchKeys: ["ist-ihl", "izm"] },
  { id: uid(3, 15), slug: "audi-a6", brand: "Audi", model: "A6", classSlug: "premium", seats: 5, bags: 3, transmission: "AUTOMATIC", fuelType: "DIESEL", consumption: 6.4, consumptionUnit: "L_PER_100KM", dailyPrice: 540000, description: { tr: "Sessiz kabini ve dengeli dizel motoruyla uzun yolların prestij seçeneği.", en: "A quiet cabin and a balanced diesel make it the long-distance prestige pick." }, branchKeys: ["ist-kdk", "ayt", "mug"] },
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

// ---------- SSS ----------

export type FaqTopic = "rezervasyon" | "odeme" | "teslim" | "hasar" | "hesap" | "kurumsal";
export type FaqSeed = {
  id: string;
  audience: "INDIVIDUAL" | "CORPORATE";
  topic: FaqTopic;
  sortOrder: number;
  question: L;
  answer: L;
};

export const faq: FaqSeed[] = [
  { id: uid(6, 1), audience: "INDIVIDUAL", topic: "rezervasyon", sortOrder: 1, question: { tr: "Rezervasyonu iptal edebilir miyim?", en: "Can I cancel my reservation?" }, answer: { tr: "Alış saatinden 24 saat öncesine kadar ücretsiz iptal edebilirsiniz.", en: "You can cancel free of charge up to 24 hours before pick-up." } },
  { id: uid(6, 2), audience: "INDIVIDUAL", topic: "teslim", sortOrder: 2, question: { tr: "Hangi belgeler gerekli?", en: "Which documents do I need?" }, answer: { tr: "Geçerli ehliyet ve kimlik belgesi yeterlidir.", en: "A valid driving licence and an ID document are enough." } },
  { id: uid(6, 3), audience: "INDIVIDUAL", topic: "teslim", sortOrder: 3, question: { tr: "Aracı farklı bir şehre iade edebilir miyim?", en: "Can I return the car in another city?" }, answer: { tr: "Evet. Rezervasyon sırasında bırakılacak bayiyi seçmeniz yeterli; farklı bayiye bırakmak için ek ücret alınmaz.", en: "Yes. Just choose the drop-off branch while booking; there is no extra charge for returning to a different branch." } },
  { id: uid(6, 4), audience: "INDIVIDUAL", topic: "odeme", sortOrder: 4, question: { tr: "Gösterilen fiyata neler dahil?", en: "What is included in the price shown?" }, answer: { tr: "Gösterilen tutarlar KDV dahildir ve rezervasyon özetinde kalem kalem yazılır. Gizli ücret yoktur.", en: "Prices include VAT and are itemised in the booking summary. There are no hidden fees." } },
  { id: uid(6, 5), audience: "INDIVIDUAL", topic: "hasar", sortOrder: 5, question: { tr: "Yolda kalırsam ne olur?", en: "What happens if I break down?" }, answer: { tr: "Yol Boyu Güvence kapsamında 7/24 operasyon masasına ulaşabilir, çekici yönlendirme alabilirsiniz. Arıza 24 saati aşarsa yedek araç sağlanır.", en: "With Road Assurance you can reach the 24/7 operations desk and get a tow truck dispatched. If a breakdown lasts over 24 hours, a replacement car is provided." } },
  { id: uid(6, 6), audience: "INDIVIDUAL", topic: "odeme", sortOrder: 6, question: { tr: "Ödeme gerçekten alınıyor mu?", en: "Is the payment real?" }, answer: { tr: "Hayır. Bu site kurgusal bir öğrenme projesidir; ödeme adımında para alınmaz.", en: "No. This site is a fictional learning project; no money is taken at the payment step." } },
  { id: uid(6, 12), audience: "INDIVIDUAL", topic: "hesap", sortOrder: 7, question: { tr: "Şifremi unuttum, ne yapmalıyım?", en: "I forgot my password. What should I do?" }, answer: { tr: "Giriş sayfasındaki \"Şifremi unuttum\" bağlantısından e-posta adresinizi girerek yeni şifre belirleyebilirsiniz.", en: "Use the \"Forgot my password\" link on the log-in page and enter your email address to set a new password." } },
  { id: uid(6, 13), audience: "INDIVIDUAL", topic: "hesap", sortOrder: 8, question: { tr: "Hesabımı silebilir miyim?", en: "Can I delete my account?" }, answer: { tr: "Evet. Profil sayfasındaki Ayarlar bölümünden hesabınızı kalıcı olarak silebilirsiniz. Geçmiş rezervasyon kayıtları anonim olarak saklanır.", en: "Yes. You can delete your account permanently from Settings on your profile page. Past booking records are kept anonymously." } },
  { id: uid(6, 7), audience: "CORPORATE", topic: "kurumsal", sortOrder: 1, question: { tr: "Kurumsal kiralama nasıl işliyor?", en: "How does corporate rental work?" }, answer: { tr: "Formu doldurursunuz, satış ekibimiz sizi arar. Araçlar istediğiniz yere teslim edilir ve istediğiniz yerden alınır; fiyat buna göre belirlenir.", en: "You fill in the form and our sales team calls you. Cars are delivered to and collected from wherever you choose, and the price is set accordingly." } },
  { id: uid(6, 8), audience: "CORPORATE", topic: "kurumsal", sortOrder: 2, question: { tr: "Birden fazla araç kiralayabilir miyim?", en: "Can I rent more than one car?" }, answer: { tr: "Evet. Araç sayısını ve süreyi formda belirtmeniz yeterli.", en: "Yes. Just state the number of cars and the period in the form." } },
  { id: uid(6, 9), audience: "CORPORATE", topic: "kurumsal", sortOrder: 3, question: { tr: "Hangi kiralama süreleri var?", en: "Which rental periods are available?" }, answer: { tr: "Günlük, haftalık ve aylık kısa dönemden uzun dönem filo sözleşmelerine kadar seçenek sunuyoruz.", en: "From daily, weekly and monthly short-term rental to long-term fleet contracts." } },
  { id: uid(6, 10), audience: "CORPORATE", topic: "kurumsal", sortOrder: 4, question: { tr: "Filo yönetim paneli var mı?", en: "Is there a fleet management panel?" }, answer: { tr: "Akıllı Kurumsal Filo Kiralama ürününde Novera Admin Paneli dahildir; araçları, sözleşmeleri ve masrafları tek yerden takip edersiniz.", en: "The Smart Corporate Fleet Rental product includes the Novera Admin Panel, where you follow cars, contracts and costs in one place." } },
  { id: uid(6, 11), audience: "CORPORATE", topic: "kurumsal", sortOrder: 5, question: { tr: "Elektrikli ve hibrit araç seçeneği var mı?", en: "Are electric and hybrid cars available?" }, answer: { tr: "Evet. Yeşil Filo ürünümüzde en güncel elektrikli ve hibrit araçlar bulunur.", en: "Yes. Our Green Fleet product offers the latest electric and hybrid cars." } },
];

// ---------- Ürünler (SPEC Ek A) ----------

export const products = [
  {
    slug: "akilli-kurumsal-filo", featured: true, sortOrder: 1,
    title: { tr: "Akıllı Kurumsal Filo Kiralama", en: "Smart Corporate Fleet Rental" },
    concept: { tr: "Şirketinize son model araç filosu tahsis ederken, arkasında tüm filoyu yöneteceğiniz Merkezi Admin Panelini hediye ediyoruz.", en: "While we assign your company a fleet of the latest cars, we also give you the Central Admin Panel to manage the whole fleet." },
    whatYouGet: { tr: "Şirketinizin ihtiyacına uygun (binek, SUV, ticari veya hibrit) uzun dönem kiralık araç filosu.", en: "A long-term rental fleet that fits your company's needs (passenger, SUV, commercial or hybrid)." },
    techBenefits: {
      tr: [
        "Novera Admin Paneli Dahil: Araçların hangi personele zimmetli olduğunu, sözleşme sürelerini, faturaları ve HGS masraflarını tek tıkla takip edin.",
        "Canlı GPS ve Telematik: Kiralanan araçların hız, kontak durumu, rota geçmişi ve yakıt tüketimini canlı haritadan izleyin.",
        "Masraf ve ceza takibini otomatikleştiren şirket yönetim arayüzü.",
      ],
      en: [
        "Novera Admin Panel included: see which employee each car is assigned to, contract terms, invoices and toll costs in one click.",
        "Live GPS and telematics: follow the speed, ignition status, route history and fuel use of rented cars on a live map.",
        "A company management interface that automates cost and fine tracking.",
      ],
    },
  },
  {
    slug: "vip-mobilite", featured: false, sortOrder: 2,
    title: { tr: "Yönetici ve Premium Araç Kiralama (VIP Mobilite)", en: "Executive and Premium Car Rental (VIP Mobility)" },
    concept: { tr: "Üst düzey şirket yöneticileri ve kurumsal konuklar için lüks segment, tam donanımlı ve öncelikli mobilite çözümü.", en: "A luxury-segment, fully equipped and priority mobility solution for senior executives and corporate guests." },
    whatYouGet: { tr: "E ve F segmenti prestij araçlar (Audi, BMW, Mercedes vb.), opsiyonel VIP şoför desteği.", en: "E and F segment prestige cars (Audi, BMW, Mercedes and others), with optional VIP chauffeur support." },
    techBenefits: {
      tr: [
        "Öncelikli Mobil Konsiyerj: Sürücüye ve yöneticiye özel VIP destek hattı.",
        "Hızlı Transfer ve Şoför Koordinasyonu: Mobil arayüz üzerinden karşılama, rota optimizasyonu ve uçuş takibi.",
      ],
      en: [
        "Priority mobile concierge: a VIP support line for the driver and the executive.",
        "Fast transfer and chauffeur coordination: meet-and-greet, route optimisation and flight tracking from a mobile interface.",
      ],
    },
  },
  {
    slug: "esnek-kisa-donem", featured: false, sortOrder: 3,
    title: { tr: "Esnek & Kısa Dönem Araç Kiralama (KOBİ ve Bireysel)", en: "Flexible and Short-Term Car Rental (SMEs and Individuals)" },
    concept: { tr: "Proje bazlı işler, acil saha ihtiyaçları veya dönemsel seyahatler için taahhütsüz, hızlı teslimatlı kiralama.", en: "No-commitment, fast-delivery rental for project work, urgent field needs or seasonal travel." },
    whatYouGet: { tr: "Günlük, haftalık veya aylık periyotlarla son model araçlar.", en: "Latest-model cars on daily, weekly or monthly terms." },
    techBenefits: {
      tr: [
        "Novera Driver App: Anahtarı teslim alırken çizik/hasar kaydını telefondan fotoğraflayıp dijital tutanak tutabilme.",
        "Uygulama İçi SOS Butonu: Olası bir aksilikte tek tuşla konumu merkeze iletip yardım çağırabilme.",
      ],
      en: [
        "Novera Driver App: photograph scratches or damage at key hand-over and keep a digital report from your phone.",
        "In-app SOS button: send your location to the operations centre and call for help with one tap if something goes wrong.",
      ],
    },
  },
  {
    slug: "yesil-filo", featured: false, sortOrder: 4,
    title: { tr: "Yeşil Filo (Elektrikli & Hibrit Araç Kiralama)", en: "Green Fleet (Electric and Hybrid Car Rental)" },
    concept: { tr: "Karbon ayak izini azaltmak isteyen kurumsal şirketler için sürdürülebilir yeni nesil filo çözümü.", en: "A sustainable, next-generation fleet solution for companies that want to reduce their carbon footprint." },
    whatYouGet: { tr: "En güncel elektrikli ve hibrit araç parkı.", en: "The latest electric and hybrid car park." },
    techBenefits: {
      tr: ["Panel üzerinden anlık batarya sağlığı, şarj istasyonu durumu ve şirketinize sağladığı karbon emisyon tasarrufu raporlaması."],
      en: ["Live battery health, charging station status and a report of the carbon emissions your company saves, all from the panel."],
    },
  },
];

// ---------- Hizmetler (SPEC Ek A; maddeleri Ek A'daki iddialarla sınırlı) ----------

export const services = [
  {
    slug: "akilli-yol-yardim-cekici", sortOrder: 1,
    title: { tr: "Akıllı Yol Yardım & Çekici", en: "Smart Roadside Assistance and Towing" },
    summary: { tr: "Kaza/arıza anında GPS koordinatınıza en yakın anlaşmalı çekiciyi canlı yönlendirme.", en: "In an accident or breakdown, the nearest partner tow truck is dispatched live to your GPS position." },
    points: { tr: ["GPS konumunuza en yakın çekici", "Canlı yönlendirme", "Kaza ve arıza anında destek"], en: ["Tow truck nearest to your GPS position", "Live dispatch", "Help for accidents and breakdowns"] },
  },
  {
    slug: "canli-operasyon-masasi", sortOrder: 2,
    title: { tr: "7/24 Canlı Operasyon Masası", en: "24/7 Live Operations Desk" },
    summary: { tr: "Sürücülerin uygulama veya telefon üzerinden anında bağlanabildiği kriz yönetimi.", en: "Crisis management that drivers can reach instantly through the app or by phone." },
    points: { tr: ["Gece gündüz erişim", "Uygulama veya telefonla bağlanma", "Kriz yönetimi"], en: ["Reachable day and night", "Connect through the app or by phone", "Crisis management"] },
  },
  {
    slug: "kesintisiz-ikame-arac", sortOrder: 3,
    title: { tr: "Kesintisiz İkame (Yedek) Araç", en: "Uninterrupted Replacement Car" },
    summary: { tr: "Arıza 24 saati aştığında işin durmaması için kapınıza gelen eşdeğer yedek araç.", en: "When a breakdown lasts over 24 hours, an equivalent replacement car comes to your door so work does not stop." },
    points: { tr: ["24 saati aşan arızada devreye girer", "Eşdeğer yedek araç", "Adresinize teslim"], en: ["Applies when a breakdown exceeds 24 hours", "An equivalent replacement car", "Delivered to your address"] },
  },
  {
    slug: "periyodik-bakim-lastik-oteli", sortOrder: 4,
    title: { tr: "Periyodik Bakım & Lastik Oteli", en: "Scheduled Maintenance and Tyre Storage" },
    summary: { tr: "Yaz/kış lastiği değişimi, muayene takibi ve adresten vale ile servis hizmeti.", en: "Summer and winter tyre changes, inspection tracking and valet pick-up from your address for servicing." },
    points: { tr: ["Yaz/kış lastiği değişimi", "Muayene takibi", "Adresten vale ile servis"], en: ["Summer and winter tyre changes", "Inspection tracking", "Valet service from your address"] },
  },
  {
    slug: "novera-sos", sortOrder: 5,
    title: { tr: "Novera SOS & Acil Durum Müdahale", en: "Novera SOS and Emergency Response" },
    summary: { tr: "Tek dokunuşla tüm acil müdahale birimleri canlı konumunuzda.", en: "With one tap, all emergency response units reach your live location." },
    points: { tr: ["Tek dokunuşla çağrı", "Canlı konumunuz iletilir", "Acil müdahale birimleri yönlendirilir"], en: ["One-tap call", "Your live location is sent", "Emergency units are dispatched"] },
  },
];

// Kampanya kodları (SPEC §2.3, kurgusal). Yüzde, araç ve ek hizmetlerin toplamından düşer.
export const promoCodes = [
  { code: "NOVERA10", percent: 10 },
  { code: "HOSGELDIN", percent: 5 },
];
