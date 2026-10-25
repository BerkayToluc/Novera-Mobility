// The parts of the seed that touch business data a person may have changed on a live database: exchange rates and
// campaign codes. They only ADD what is missing and never overwrite what is there (QUALITY G-05, §3.3), so running
// the seed again on a live database cannot re-open a closed code or put the sample rates back over live ones.
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { promoCodes, rates } from "./seed-data";

type Db = Pick<PrismaClient, "exchangeRate" | "promoCode">;

// The sample rates are only a start: the daily update replaces them. A rate that exists is left alone.
export async function seedExchangeRates(db: Db): Promise<void> {
  for (const r of rates) {
    await db.exchangeRate.upsert({ where: { currency: r.currency }, update: {}, create: r });
  }
}

const DEMO_CODE_DAYS = 30;

// The sample campaign codes (NOVERA10, HOSGELDIN) exist only when SEED_DEMO=1 asks for them, and a code that
// exists is left exactly as it is: closed stays closed, dates and percent are not reset. A new one is valid for 30 days.
export async function seedDemoPromoCodes(db: Db, now: Date = new Date()): Promise<number> {
  const validUntil = new Date(now.getTime() + DEMO_CODE_DAYS * 24 * 60 * 60 * 1000);
  for (const c of promoCodes) {
    await db.promoCode.upsert({
      where: { code: c.code },
      update: {},
      create: { code: c.code, percent: c.percent, validUntil, oncePerUser: true },
    });
  }
  return promoCodes.length;
}
