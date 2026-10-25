import { seedDemoPromoCodes, seedExchangeRates } from "./seed-reference";

// QUALITY G-05: the seed may run on a live database again and again; it must only add what is missing.
type Upsert = { where: Record<string, unknown>; update: Record<string, unknown>; create: Record<string, unknown> };

function fakeDb() {
  const rates: Upsert[] = [];
  const codes: Upsert[] = [];
  return {
    rates,
    codes,
    db: {
      exchangeRate: { upsert: async (args: Upsert) => void rates.push(args) },
      promoCode: { upsert: async (args: Upsert) => void codes.push(args) },
    } as never,
  };
}

describe("seed on a live database", () => {
  it("never overwrites an exchange rate that exists", async () => {
    const { db, rates } = fakeDb();
    await seedExchangeRates(db);
    expect(rates.map((r) => r.where.currency)).toEqual(["TRY", "EUR", "USD"]);
    for (const call of rates) expect(call.update).toEqual({});
  });

  it("adds the sample codes without touching one that exists, valid for 30 days", async () => {
    const { db, codes } = fakeDb();
    const now = new Date("2026-10-25T12:00:00Z");
    expect(await seedDemoPromoCodes(db, now)).toBe(2);
    expect(codes.map((c) => c.where.code)).toEqual(["NOVERA10", "HOSGELDIN"]);
    for (const call of codes) {
      // Nothing is updated, so an existing code keeps its state, dates and percent.
      expect(call.update).toEqual({});
      expect(call.create.validUntil).toEqual(new Date("2026-11-24T12:00:00Z"));
      expect(call.create).not.toHaveProperty("active", false);
    }
  });
});
