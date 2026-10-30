import type { FuelValue } from "@/lib/admin-models";
import type { ExtraPricing } from "@/lib/extra";
import type { Transmission } from "@/lib/vehicle";
import { DESCRIPTIONS, MODELS } from "./fleet";

// The sample fleet (USE_MOCKS=1, local work and tests only, lib/mode.ts) of one "world" (lib/mock-world.ts): its models, its
// cars and its extra services. One store, so the panel, the fleet page, the search and the branches all see the same cars:
// what a branch has, what a model has, and what the search finds are counted from the same rows, the way the database does.
//
// A test that changes the fleet works in a world of its own, so the tests that count what is on the site never see its changes;
// everyone else is in "main", which is the sample data as made. It lives on `globalThis`: the pages and the actions of one
// server process share it however Next splits the modules.
export type ModelRecord = {
  slug: string;
  brand: string;
  model: string;
  classSlug: string;
  seats: number;
  bags: number;
  transmission: Transmission;
  fuelType: FuelValue;
  consumption: number;
  dailyPrice: number;
  description: { tr: string; en: string };
  imageUrl: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleRecord = {
  id: string;
  plate: string;
  year: number;
  active: boolean;
  modelSlug: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtraRecord = { slug: string; name: { tr: string; en: string }; price: number; pricing: ExtraPricing; updatedAt: string };

// A sample booking cancelled from the panel (V2-31): which one, when, and why. The sample bookings themselves are fixed (mocks/reservations.ts).
export type CancellationRecord = { id: string; at: string; reason: string };

// A sample corporate quote request (V2-32). The first three belong to the corporate sample account (mocks/quotes.ts), so a change in
// the panel shows on that account's own screen.
export type QuoteRecord = {
  id: string;
  number: string;
  status: "RECEIVED" | "IN_REVIEW" | "OFFERED" | "CLOSED";
  source: "WEB" | "FLEET_RENEWAL";
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  vehicleCount: number;
  durationMonths: number;
  vehicleType: string;
  deliveryCities: string | null;
  notes: string | null;
  internalNote: string | null;
  productSlug: string | null;
  accountEmail: string | null;
  createdAt: string;
  updatedAt: string;
  anonymized: boolean;
};

// A sample contact message (V2-32).
export type MessageRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  createdAt: string;
  handledAt: string | null;
  handledBy: { name: string; email: string } | null;
  anonymized: boolean;
};

export type FleetWorld = {
  models: ModelRecord[];
  vehicles: VehicleRecord[];
  extras: ExtraRecord[];
  cancellations: CancellationRecord[];
  quotes: QuoteRecord[];
  messages: MessageRecord[];
};

const store = globalThis as typeof globalThis & { __noveraMockFleet?: Map<string, FleetWorld> };
// A world holds a copy of the sample data; an idle server keeps at most this many of them.
const MAX_WORLDS = 60;

// The province code of each sample branch, for the plates of its cars ("34 NV 1001", like the database's seed).
const PROVINCE: Record<string, string> = {
  istanbul: "34",
  ankara: "06",
  izmir: "35",
  antalya: "07",
  bursa: "16",
  adana: "01",
  gaziantep: "27",
  konya: "42",
  eskisehir: "26",
  kayseri: "38",
  samsun: "55",
  diyarbakir: "21",
  trabzon: "61",
};

const EXTRAS: Array<Omit<ExtraRecord, "updatedAt">> = [
  { slug: "additional-driver", name: { tr: "Ek sürücü", en: "Additional driver" }, price: 15000, pricing: "PER_DAY" },
  { slug: "child-seat", name: { tr: "Çocuk koltuğu", en: "Child seat" }, price: 10000, pricing: "PER_DAY" },
  { slug: "full-coverage", name: { tr: "Tam kapsamlı sigorta", en: "Full coverage insurance" }, price: 30000, pricing: "PER_DAY" },
  { slug: "wifi", name: { tr: "Araç içi Wi-Fi", en: "In-car Wi-Fi" }, price: 8000, pricing: "PER_DAY" },
  { slug: "hgs", name: { tr: "HGS etiketi", en: "Toll tag (HGS)" }, price: 25000, pricing: "FIXED" },
];

function seed(): FleetWorld {
  const created = new Date(Date.now() - 300 * 86_400_000).toISOString();
  const models: ModelRecord[] = MODELS.map((model) => ({
    slug: model.slug,
    brand: model.brand,
    model: model.model,
    classSlug: model.class,
    seats: model.seats,
    bags: model.bags,
    transmission: model.transmission,
    fuelType: model.fuelType,
    consumption: model.consumption.value,
    dailyPrice: model.dailyKurus,
    description: DESCRIPTIONS[model.slug]!,
    imageUrl: `/fleet/${model.slug}.webp`,
    retiredAt: null,
    createdAt: created,
    updatedAt: created,
  }));

  // One car for each model at each branch that stocks it.
  let sequence = 1001;
  const vehicles: VehicleRecord[] = [];
  for (const model of MODELS) {
    for (const branchId of model.branches) {
      vehicles.push({
        id: `${branchId}__${model.slug}`,
        plate: `${PROVINCE[branchId.split("-")[0]!] ?? "34"} NV ${sequence}`,
        year: 2025 + (sequence % 2),
        active: true,
        modelSlug: model.slug,
        branchId,
        createdAt: created,
        updatedAt: created,
      });
      sequence += 1;
    }
  }
  const extras: ExtraRecord[] = EXTRAS.map((extra) => ({ ...extra, updatedAt: created }));
  return { models, vehicles, extras, cancellations: [], quotes: seedQuotes(), messages: seedMessages() };
}

// Three are waiting (RECEIVED), as the sample summary says (mocks/admin.ts).
function seedQuotes(): QuoteRecord[] {
  const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const base = { source: "WEB" as const, phone: null, deliveryCities: null, notes: null, internalNote: null, productSlug: null, accountEmail: null, anonymized: false };
  const corporate = { accountEmail: "filo@egelojistik.example", contactName: "Mert Kaya", email: "filo@egelojistik.example", companyName: "Ege Lojistik A.Ş." };
  return [
    { ...base, ...corporate, id: "q3", number: "TKL-2026-48213", status: "IN_REVIEW", vehicleCount: 21, durationMonths: 24, vehicleType: "SUV", deliveryCities: "İzmir, Ankara", createdAt: "2026-10-02T09:30:00Z", updatedAt: "2026-10-03T09:30:00Z" },
    { ...base, ...corporate, id: "q2", number: "TKL-2026-31870", status: "OFFERED", vehicleCount: 6, durationMonths: 12, vehicleType: "Sedan", internalNote: "İndirim payı %8, müdür onayladı.", createdAt: "2026-08-14T13:05:00Z", updatedAt: "2026-08-20T13:05:00Z" },
    { ...base, ...corporate, id: "q1", number: "TKL-2025-90442", status: "OFFERED", vehicleCount: 1, durationMonths: 6, vehicleType: "Hatchback", createdAt: "2025-11-20T08:12:00Z", updatedAt: "2025-11-25T08:12:00Z" },
    { ...base, id: "q4", number: "TKL-2026-50111", status: "RECEIVED", companyName: "Anadolu Gıda Ltd.", contactName: "Selin Arslan", email: "selin@anadolugida.example", phone: "+90 312 555 01 11", vehicleCount: 12, durationMonths: 18, vehicleType: "Van", deliveryCities: "Ankara", notes: "Soğuk zincir için uygun araç var mı?", productSlug: "akilli-kurumsal-filo", createdAt: day(1), updatedAt: day(1) },
    { ...base, id: "q5", number: "TKL-2026-50112", status: "RECEIVED", companyName: "Marmara İnşaat", contactName: "Kerem Aydın", email: "kerem@marmarainsaat.example", vehicleCount: 4, durationMonths: 6, vehicleType: "SUV", createdAt: day(2), updatedAt: day(2) },
    { ...base, id: "q6", number: "TKL-2026-50120", status: "RECEIVED", companyName: "Karadeniz Turizm", contactName: "Zeynep Çelik", email: "zeynep@karadenizturizm.example", vehicleCount: 30, durationMonths: 36, vehicleType: "Minibüs", createdAt: day(3), updatedAt: day(3) },
    { ...base, id: "q7", number: "TKL-2026-50090", status: "IN_REVIEW", source: "FLEET_RENEWAL", companyName: "Doğu Enerji A.Ş.", contactName: "Burak Şen", email: "burak@dogu-enerji.example", vehicleCount: 9, durationMonths: 24, vehicleType: "Pick-up", notes: "Sözleşme yenileme talebi.", createdAt: day(6), updatedAt: day(4) },
    { ...base, id: "q8", number: "TKL-2026-49902", status: "CLOSED", companyName: "Akdeniz Lojistik", contactName: "Nur Kılıç", email: "nur@akdenizlojistik.example", vehicleCount: 3, durationMonths: 12, vehicleType: "Sedan", internalNote: "Müşteri başka firmayı seçti.", createdAt: day(40), updatedAt: day(30) },
    { ...base, id: "q9", number: "TKL-2024-00311", status: "CLOSED", companyName: "Eski Müşteri Ltd.", contactName: "Silindi", email: "", vehicleCount: 2, durationMonths: 12, vehicleType: "Sedan", createdAt: "2024-03-05T10:00:00Z", updatedAt: "2024-03-20T10:00:00Z", anonymized: true },
  ];
}

// Four wait (not handled, not erased), as the sample summary says (mocks/admin.ts).
function seedMessages(): MessageRecord[] {
  const hours = (count: number) => new Date(Date.now() - count * 3_600_000).toISOString();
  const base = { phone: null, handledAt: null, handledBy: null, anonymized: false };
  return [
    { ...base, id: "m1", name: "Ayşe Yılmaz", email: "ayse@example.com", phone: "+90 532 555 01 01", subject: "Kurumsal fiyat sorusu", message: "Merhaba, on araçlık bir filo için fiyat almak istiyoruz. Kasım ayında teslim gerekiyor, uygun musunuz?", createdAt: hours(3) },
    { ...base, id: "m2", name: "Mehmet Demir", email: "mehmet@example.com", subject: "Rezervasyon değişikliği", message: "NVR-2026-00207 numaralı rezervasyonumun dönüş saatini bir saat ileri alabilir miyiz?", createdAt: hours(20) },
    { ...base, id: "m3", name: "Elif Kara", email: "elif.kara@example.com", subject: "Havalimanı teslimi", message: "Antalya havalimanında gece yarısından sonra araç teslimi mümkün mü?", createdAt: hours(30) },
    { ...base, id: "m4", name: "Can Öztürk", email: "can@example.com", subject: "Çocuk koltuğu", message: "Çocuk koltuğu rezervasyon sonrası eklenebiliyor mu?", createdAt: hours(52) },
    { ...base, id: "m5", name: "Deniz Acar", email: "deniz@example.com", subject: "Fatura isteği", message: "Geçen ayki kiralamam için fatura rica ediyorum.", createdAt: hours(120), handledAt: hours(100), handledBy: { name: "Deniz Yönetici", email: "yonetici@novera.example" } },
    { ...base, id: "m6", name: "Silindi", email: "", subject: "Eski soru", message: "", createdAt: "2024-02-01T10:00:00Z", anonymized: true },
  ];
}

export function fleetOf(world: string): FleetWorld {
  const worlds = (store.__noveraMockFleet ??= new Map());
  let found = worlds.get(world);
  if (!found) {
    // The oldest world that is not "main" makes room, so a test run cannot grow the server without end.
    if (worlds.size >= MAX_WORLDS) {
      const oldest = [...worlds.keys()].find((key) => key !== "main");
      if (oldest) worlds.delete(oldest);
    }
    found = seed();
    worlds.set(world, found);
  }
  return found;
}

// A tick later than the version that was read, so two quick edits never share one.
export const nextVersion = (previous: string): string => new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
