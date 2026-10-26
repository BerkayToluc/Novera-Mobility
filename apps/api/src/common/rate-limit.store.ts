import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Where the counters live. In production it is the database (`RateLimitHit`), so a restart or a second
// instance sees the same counts; tests use an in-memory one (rate-limit.testing.ts).
export abstract class RateLimitStore {
  // Adds one to the counter of (key, bucket, window) and returns the new count. Must be atomic.
  abstract hit(key: string, bucket: string, windowStart: Date): Promise<number>;
  // Deletes the counters of windows that started before `before`; returns how many.
  abstract deleteBefore(before: Date): Promise<number>;
}

@Injectable()
export class PrismaRateLimitStore extends RateLimitStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  // One statement, so two requests at the same moment are both counted: the second waits for the first row lock
  // and then adds to its result.
  async hit(key: string, bucket: string, windowStart: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitHit" ("key", "bucket", "windowStart", "count")
      VALUES (${key}, ${bucket}, ${windowStart}, 1)
      ON CONFLICT ("key", "bucket", "windowStart")
      DO UPDATE SET "count" = "RateLimitHit"."count" + 1
      RETURNING "count"`;
    return rows[0]?.count ?? 1;
  }

  async deleteBefore(before: Date): Promise<number> {
    const result = await this.prisma.rateLimitHit.deleteMany({ where: { windowStart: { lt: before } } });
    return result.count;
  }
}
