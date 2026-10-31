// Yalnızca örnek filo müşterilerini ekler (V2-35): Örnek Lojistik A.Ş. ve Yeşil Enerji Ltd. (sözleşme, araç, personel, zimmet, okuma, fatura ve masraf).
// Tam seed'in (`db:seed`) aksine bayilere, modellere ve araçlara dokunmaz, bu yüzden canlıda yönetim panelinden yapılmış düzenlemeleri geri almaz.
// Yalnız eksik olanı ekler; tekrar çalıştırmak kopya üretmez. Kullanıcılar yalnızca FLEET_SEED_PASSWORD verilirse açılır (repoya yazılmaz);
// katalogda (ürünler, araç modelleri) bulunmayan bir şey için hata verir.
// Çalıştırma: pnpm --filter @novera/api db:seed:fleet
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedFleet } from "./seed-fleet";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL tanımlı değil (apps/api/.env dosyasını kontrol edin).");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const fleet = await seedFleet(prisma, { password: process.env.FLEET_SEED_PASSWORD });
  if (!process.env.FLEET_SEED_PASSWORD) console.log("  Örnek Filom kullanıcıları atlandı (FLEET_SEED_PASSWORD ile gelir).");
  console.log(`Filo seed tamam: ${fleet.companies} şirket, ${fleet.users} kullanıcı, ${fleet.contracts} sözleşme, ${fleet.cars} araç, ${fleet.people} personel, ${fleet.assignments} zimmet, ${fleet.readings} okuma, ${fleet.invoices} fatura, ${fleet.expenses} masraf eklendi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
