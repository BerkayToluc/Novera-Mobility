# V2-17 · API'deki kullanılmayan ürün/hizmet içerik kopyasını ve SSS'yi sil

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-11
**Bulgular:** QUALITY V-09 · **Mimari:** ADR-32

## Amaç
Ürün ve hizmet metinleri hem çeviri dosyalarında hem API tablolarında duruyor; web API'yi hiç çağırmıyor. G içerik modülünü istemedi (22 Ekim). Tek kaynağı çeviri dosyaları yapmak. 27 Ekim'de G, SSS'nin de web'e taşınmasını istedi (SSS için bile API'nin ayakta olması gerekiyordu).

## Kapsam
- **Kalkacak uçlar:** `GET /faq`, `GET /products`, `GET /products/:slug`, `GET /services` ve `content` modülü.
- **SSS web'e taşınır:** metinler `apps/web/messages/<dil>/faq.json`, soru listesi (kitle, konu, sıra) `lib/faq.ts`. `FaqItem` tablosu ve `FaqAudience`, `FaqTopic` enum'ları kalkar. *(27 Ekim'de yapıldı, `Refs #307`.)*
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
- [x] `GET /faq` kalktı; SSS ana sayfa ve Yardım merkezinde web'den geliyor (e2e). *(27 Ekim)*
- [x] `/products*` ve `/services` uçları 404 döner; `content` modülü yok. *(`app.routes.integration.spec.ts`)*
- [x] Kurumsal teklif formu ürün seçili gönderilince `QuoteRequest.productId` doğru dolar (test ve e2e). *(`quotes.service.spec.ts`; e2e `quote-cities.spec.ts` mevcut)*
- [x] `api-types.ts` yeniden üretildi; typecheck yeşil.
- [ ] Migration canlıda yedekli uygulandı.
- [x] QUALITY'de V-09 güncel.

## Etiketler
`faz-2` `temel` `refactor` `P1` `api` `veritabani`
