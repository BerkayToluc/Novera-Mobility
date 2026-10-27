import { RateLimitStore } from './rate-limit.store.js';

// Only for tests: the counters in memory, so a test needs no database. The database version has its own
// integration test (rate-limit.integration.spec.ts).
export class MemoryRateLimitStore extends RateLimitStore {
  readonly counts = new Map<string, number>();

  async hit(key: string, bucket: string, windowStart: Date): Promise<number> {
    const id = `${key}|${bucket}|${windowStart.toISOString()}`;
    const count = (this.counts.get(id) ?? 0) + 1;
    this.counts.set(id, count);
    return count;
  }

  async deleteBefore(before: Date): Promise<number> {
    let removed = 0;
    for (const id of this.counts.keys()) {
      if (new Date(id.split('|')[2]!) < before) {
        this.counts.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
