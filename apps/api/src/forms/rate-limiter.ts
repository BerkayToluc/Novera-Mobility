import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

// Form uçlarında (ADR-20) aynı istemciden gelen istekleri sınırlar.
//
// Bellek içidir: sunucu yeniden başlayınca sayaçlar sıfırlanır ve birden fazla sunucu
// çalışırsa her biri kendi sayacını tutar. Spam yavaşlatmak için bu yeterli (v1);
// ciddi koruma güvenlik gözden geçirmesinde (BACKLOG #39) yeniden ele alınır.
const MAX_TRACKED_KEYS = 10_000;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  // İstek izinliyse true döner ve kaydeder. Reddedilen istek sayılmaz;
  // süre dolunca istemci yeniden deneyebilir.
  allow(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
  ): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > MAX_TRACKED_KEYS) this.prune(now);
    return true;
  }

  private prune(now: number): void {
    for (const [key, times] of this.hits) {
      const newest = times[times.length - 1];
      if (newest === undefined || newest <= now - STALE_AFTER_MS) {
        this.hits.delete(key);
      }
    }
  }
}

// İstemciyi IP adresinin özetiyle (hash) tanır; IP'nin kendisi saklanmaz.
// Tarayıcı Next üzerinden geldiği için gerçek adres X-Forwarded-For başlığındadır.
// Not: API'ye doğrudan erişilebiliyorsa bu başlık taklit edilebilir (BACKLOG #39).
export function clientKeyOf(request: Request): string {
  const header = request.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header[0] : header;
  const forwarded = raw?.split(',')[0]?.trim();
  const address = forwarded || request.ip || 'unknown';
  return createHash('sha256').update(address).digest('hex').slice(0, 32);
}
