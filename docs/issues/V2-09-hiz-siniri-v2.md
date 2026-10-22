# V2-09 · Hız sınırı v2: kalıcı depo ve tüm uçlar

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-07
**Bulgular:** QUALITY G-11 · **Mimari:** ADR-27

## Amaç
Bugün hız sınırı yalnızca 8 uçta var ve bellekte tutuluyor; Render yeniden başlayınca sayaçlar sıfırlanıyor. Hedef: her uçta varsayılan bir sınır ve yeniden başlamada kaybolmayan sayaçlar.

## Kapsam
- **Kalıcı depo:**
  - `RateLimitHit` tablosu: `key`, `bucket` (uç grubu), `windowStart`, `count`; birincil anahtar `(key, bucket, windowStart)`.
  - Sayım tek bir atomik `INSERT … ON CONFLICT DO UPDATE … RETURNING count` sorgusuyla yapılır.
  - Eski pencereleri her gün bir görev siler.
- **Global guard:**
  - Her uca varsayılan sınır (okuma için 5 dakikada 300) uygulanır.
  - Uç bazında `@RateLimit({ bucket, limit, windowSec, key })` dekoratörüyle daha sıkı sınır verilir.
  - `/health` muaftır.
- **Anahtar:** girişli istekte `user:<id>`, girişsiz istekte `ip:<adres>`. `admin:<id>` V2-23'te eklenir.
- **Cevap:** sınır aşılınca `429 RATE_LIMITED` ve `Retry-After` başlığı.
- **Taşıma:** mevcut 8 uç yeni sisteme taşınır ve bellek içi sınırlayıcı kaldırılır. QUALITY §3.2'deki hedef tablo uygulanır, SECURITY.md'ye tek kaynak olarak yazılır.
- **Web:** `429` için ortak bir hata metni ("Çok fazla deneme, N dakika sonra tekrar deneyin"), TR/EN.

## Teknik notlar
- Kod: `apps/api/src/forms/rate-limiter.ts` ve onu kullananlar (auth, holds, forms).
- Ağır bir migration değildir. Tabloda indeks yalnızca birincil anahtar; temizlik `windowStart` üzerinden yapılır.
- Testlerde saat sabitlenir; gerçek Postgres entegrasyon testi eşzamanlı sayımı kanıtlar.

## Kabul kriterleri
- [ ] Her uç SECURITY.md tablosunda bir satıra sahip; tablo QUALITY §3.2 hedefiyle aynı.
- [ ] API yeniden başlatılınca sayaç korunur (entegrasyon testi: yeni uygulama örneği aynı sayacı görür).
- [ ] Aynı anahtarla eşzamanlı 20 istekte sınır tam doğru sayılır.
- [ ] `429` cevabında `Retry-After` var.
- [ ] Bellek içi `RateLimiter` kodda yok.
- [ ] QUALITY'de G-11 güncel.

## Etiketler
`faz-2` `temel` `guvenlik` `P1` `api` `veritabani`
