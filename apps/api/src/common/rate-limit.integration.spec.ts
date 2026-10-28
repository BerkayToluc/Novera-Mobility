import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitCleaner } from './rate-limit.cleaner.js';
import { RateLimitedException, type RateLimitSpec } from './rate-limit.js';
import { RateLimitService } from './rate-limit.service.js';
import { PrismaRateLimitStore } from './rate-limit.store.js';

// Against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one.
const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('rate limit counters in PostgreSQL (ADR-27)', () => {
  const run = randomUUID().slice(0, 8);
  const spec: RateLimitSpec = { bucket: `it-${run}`, limit: 10, windowSec: 3600 };
  const connections: PrismaService[] = [];
  const connect = async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = new PrismaService();
    await prisma.$connect();
    connections.push(prisma);
    return prisma;
  };
  const now = new Date(Date.UTC(2031, 5, 1, 10, 30, 0));

  afterAll(async () => {
    const prisma = connections[0]!;
    await prisma.rateLimitHit.deleteMany({ where: { bucket: { startsWith: `it-${run}` } } });
    await Promise.all(connections.map((connection) => connection.$disconnect()));
  });

  const outcome = (limits: RateLimitService, key: string, at: Date = now) =>
    limits.consume(spec, key, at).then(
      () => 'allowed',
      (error: unknown) => (error instanceof RateLimitedException ? 'refused' : Promise.reject(error)),
    );

  it('counts 20 simultaneous requests exactly: 10 allowed, 10 refused', async () => {
    const limits = new RateLimitService(new PrismaRateLimitStore(await connect()));
    const results = await Promise.all(Array.from({ length: 20 }, () => outcome(limits, `ip:${run}-parallel`)));
    expect(results.filter((result) => result === 'allowed')).toHaveLength(10);
    expect(results.filter((result) => result === 'refused')).toHaveLength(10);
    const row = await connections[0]!.rateLimitHit.findFirst({
      where: { key: `ip:${run}-parallel`, bucket: spec.bucket },
    });
    expect(row?.count).toBe(20);
  });

  it('keeps the counter when the API starts again: a new instance sees the same count', async () => {
    const before = new RateLimitService(new PrismaRateLimitStore(await connect()));
    for (let i = 0; i < 10; i += 1) expect(await outcome(before, `ip:${run}-restart`)).toBe('allowed');
    // "Restart": a new connection and new objects, nothing shared in memory.
    const after = new RateLimitService(new PrismaRateLimitStore(await connect()));
    expect(await outcome(after, `ip:${run}-restart`)).toBe('refused');
  });

  it('starts a fresh count in the next window and keeps keys apart', async () => {
    const limits = new RateLimitService(new PrismaRateLimitStore(await connect()));
    for (let i = 0; i < 11; i += 1) await outcome(limits, `ip:${run}-window`);
    expect(await outcome(limits, `ip:${run}-window`, new Date(now.getTime() + 3600 * 1000))).toBe('allowed');
    expect(await outcome(limits, `ip:${run}-other`)).toBe('allowed');
  });

  it('the daily cleanup deletes windows older than a day and keeps the recent ones', async () => {
    const store = new PrismaRateLimitStore(await connect());
    const limits = new RateLimitService(store);
    const old = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
    await limits.consume(spec, `ip:${run}-old`, old);
    await limits.consume(spec, `ip:${run}-recent`, now);
    await new RateLimitCleaner(store).clean(now);
    const keys = (await connections[0]!.rateLimitHit.findMany({ where: { bucket: spec.bucket } })).map(
      (row) => row.key,
    );
    expect(keys).not.toContain(`ip:${run}-old`);
    expect(keys).toContain(`ip:${run}-recent`);
  });
});
