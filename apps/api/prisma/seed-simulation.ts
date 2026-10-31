// Yalnızca simülasyon verisini ekler: şarj istasyonları (V2-40) ve canlı takip rotaları (V2-43). Tam seed'in (`db:seed`) aksine bayilere, modellere
// ve araçlara dokunmaz, bu yüzden canlıda yönetim panelinden yapılmış düzenlemeleri geri almaz. İkisi de yalnız eksik olanı ekler; tekrar
// çalıştırmak kopya üretmez.
// Çalıştırma: pnpm --filter @novera/api db:seed:simulation
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedRoutes } from "./seed-routes";
import { seedStations } from "./seed-stations";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL tanımlı değil (apps/api/.env dosyasını kontrol edin).");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const stations = await seedStations(prisma);
  const routes = await seedRoutes(prisma);
  console.log(`Simülasyon seed tamam: ${stations.stations} şarj istasyonu, ${routes.routes} takip rotası eklendi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
