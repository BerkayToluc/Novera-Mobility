# V2-17 · API'deki kullanılmayan ürün/hizmet içerik kopyasını sil

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-11
**Bulgular:** QUALITY V-09 · **Mimari:** ADR-32

## Amaç
Ürün ve hizmet metinleri hem çeviri dosyalarında hem API tablolarında duruyor; web API'yi hiç çağırmıyor. G içerik modülünü istemedi (22 Ekim). Tek kaynağı çeviri dosyaları yapmak.

## Kapsam
- **Kalkacak uçlar:** `GET /products`, `GET /products/:slug`, `GET /services` ve `content` modülü.
- **Veritabanı:**
  - `Service` tablosu kalkar;
  - `Product`'ın metin alanları kalkar, yalnızca `id` ve `slug` kalır.
  - `QuoteRequest.productId` ilişkisi korunur.
- **Seed:** ürünleri yalnızca slug olarak ekler.
- **Sözleşme ve tipler:** `openapi.yaml`'dan uçlar ve şemalar çıkar; web `pnpm --filter @novera/web gen:api` ile `lib/api-types.ts`'i yeniden üretir.
- **Belgeler:** v1'deki "ürün içeriği API'den gelir" ifadeleri zaten arşivde. v2 belgelerinde ADR-32 geçerlidir; ek iş yok.

## Teknik notlar
Dosyalar: `apps/api/src/content/*`, `prisma/schema.prisma:334-354`, `prisma/seed.ts:108-122`, `app.module.ts`. Migration veri siler. Canlıda bu tabloları kullanan bir şey olmadığı PR'da `grep` ile gösterilir.

## Kabul kriterleri
- [ ] Uçlar 404 döner; `content` modülü yok.
- [ ] Kurumsal teklif formu ürün seçili gönderilince `QuoteRequest.productId` doğru dolar (test ve e2e).
- [ ] `api-types.ts` yeniden üretildi; typecheck yeşil.
- [ ] Migration canlıda yedekli uygulandı.
- [ ] QUALITY'de V-09 güncel.

## Etiketler
`faz-2` `temel` `refactor` `P1` `api` `veritabani`
