// Veritabanını örnek verilerle doldurur. Tekrar çalıştırmak güvenlidir (upsert).
// Çalıştırma: pnpm --filter @novera/api db:seed
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  branches,
  buildVehicles,
  classes,
  extras,
  faq,
  modelImages,
  models,
  products,
  promoCodes,
  rates,
  services,
} from "./seed-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL tanımlı değil (apps/api/.env dosyasını kontrol edin).");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  for (const c of classes) {
    await prisma.vehicleClass.upsert({
      where: { slug: c.slug },
      update: { nameTr: c.nameTr, nameEn: c.nameEn },
      create: c,
    });
  }

  for (const b of branches) {
    const data = {
      name: b.name,
      city: b.city,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      phone: b.phone,
      email: b.email,
      openingHours: b.openingHours,
    };
    await prisma.branch.upsert({ where: { id: b.id }, update: data, create: { id: b.id, ...data } });
  }

  const classIdBySlug = new Map(classes.map((c) => [c.slug, c.id]));
  for (const m of models) {
    const classId = classIdBySlug.get(m.classSlug);
    if (!classId) throw new Error(`Bilinmeyen sınıf: ${m.classSlug}`);
    const data = {
      brand: m.brand,
      model: m.model,
      seats: m.seats,
      bags: m.bags,
      transmission: m.transmission,
      fuelType: m.fuelType,
      consumption: m.consumption,
      consumptionUnit: m.consumptionUnit,
      dailyPrice: m.dailyPrice,
      description: m.description,
      imageUrl: modelImages[m.slug] ?? null,
      classId,
    };
    await prisma.vehicleModel.upsert({ where: { slug: m.slug }, update: data, create: { id: m.id, slug: m.slug, ...data } });
  }

  const branchIdByKey = new Map(branches.map((b) => [b.key, b.id]));
  const modelIdBySlug = new Map(models.map((m) => [m.slug, m.id]));
  const vehicles = buildVehicles();
  for (const v of vehicles) {
    const vehicleModelId = modelIdBySlug.get(v.modelSlug);
    const branchId = branchIdByKey.get(v.branchKey);
    if (!vehicleModelId || !branchId) throw new Error(`Araç bağlantısı eksik: ${v.plate}`);
    const data = { year: v.year, active: true, vehicleModelId, branchId };
    await prisma.vehicle.upsert({ where: { plate: v.plate }, update: data, create: { plate: v.plate, ...data } });
  }

  for (const e of extras) {
    const data = { nameTr: e.nameTr, nameEn: e.nameEn, price: e.price, pricing: e.pricing };
    await prisma.extra.upsert({ where: { slug: e.slug }, update: data, create: { slug: e.slug, ...data } });
  }

  for (const r of rates) {
    await prisma.exchangeRate.upsert({
      where: { currency: r.currency },
      update: { ratePerTry: r.ratePerTry },
      create: r,
    });
  }

  for (const c of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: c.code },
      update: { percent: c.percent, active: true },
      create: c,
    });
  }

  for (const f of faq) {
    const data = { audience: f.audience, topic: f.topic, question: f.question, answer: f.answer, sortOrder: f.sortOrder };
    await prisma.faqItem.upsert({ where: { id: f.id }, update: data, create: { id: f.id, ...data } });
  }

  for (const p of products) {
    const data = {
      title: p.title,
      concept: p.concept,
      whatYouGet: p.whatYouGet,
      techBenefits: p.techBenefits,
      featured: p.featured,
      sortOrder: p.sortOrder,
    };
    await prisma.product.upsert({ where: { slug: p.slug }, update: data, create: { slug: p.slug, ...data } });
  }

  for (const s of services) {
    const data = { title: s.title, summary: s.summary, points: s.points, sortOrder: s.sortOrder };
    await prisma.service.upsert({ where: { slug: s.slug }, update: data, create: { slug: s.slug, ...data } });
  }

  console.log("Seed tamam:");
  console.log(`  ${classes.length} sınıf, ${branches.length} bayi, ${models.length} model, ${vehicles.length} araç`);
  console.log(`  ${extras.length} ek hizmet, ${rates.length} kur, ${faq.length} SSS`);
  console.log(`  ${products.length} ürün, ${services.length} hizmet, ${promoCodes.length} kampanya kodu`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });