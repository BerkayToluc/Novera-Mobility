# Kalite ve sağlamlaştırma (QUALITY)

> Durum: **v2.0** · 22 Ekim 2026. v2'nin "önce temel" kısmının (SPEC §3.A) tek kaynağıdır.
> §1'deki bulgular 22 Ekim'de `main` (`2ff4f0a`) üzerinde kodun okunmasıyla çıkarıldı. Yöntem: API, web ve veritabanı için ayrı taramalar. Lighthouse, ekran okuyucu ya da sızma testi **yapılmadı**; onlar V2-20, V2-21 ve V2-22'nin işi. G-01 kod okunarak ikinci kez doğrulandı; diğerleri tarama bulgusudur ve ilgili issue'da geliştirici önce yeniden üretir.
> v1'in eski denetimleri (AUDIT, PERFORMANCE) [archive/v1/](archive/v1/) içinde. [SECURITY.md](SECURITY.md) güvenlik kararlarının kaydı olarak sürer.

**Seviyeler:**
- **Kritik:** canlıda kötüye kullanılabilir ve iş kuralını bozar; ilk iş.
- **Yüksek:** kötüye kullanılabilir ya da yanlış yapılandırmada açık verir.
- **Orta:** savunma eksikliği ya da bakım riski.
- **Düşük:** temizlik.

**Durum:** `Açık` → `Düzeltildi (PR #)` ya da `Kabul edildi (gerekçe)`. Bulgu kapanınca bu tablo aynı PR'da güncellenir.

---

## 1. Bulgular

### 1.1 Güvenlik (G)

| # | Seviye | Bulgu | Yer | İş | Durum |
|---|---|---|---|---|---|
| G-01 | **Kritik** | Rezervasyon ve tutmada başlangıcın gelecekte olduğu denetlenmiyor. Geçmiş tarihli rezervasyonun puanı hemen bakiyeye geçiyor (puan `endAt <= now` olunca sayılıyor). Geçmiş tarihli 365 günlük bir kiralama anında yüzlerce puan verir; puanla ödeme kuralı (toplamın yarısı) sonraki kiralamaları yarı fiyata indirir. Başlamış rezervasyon iptal edilemediği için temizlenmez de | `apps/api/src/reservations/reservation-input.ts:71-102`, `holds/holds.service.ts:217-233`, `catalog/catalog.service.ts:178-204`, `reservations/points-balance.ts:36-40` | V2-02 | Düzeltildi (V2-02, #292; kural `reservations/booking-window.ts`; canlı tespit sorgusu SECURITY.md'de; 24 Ekim 2026'da canlıda çalıştırıldı: 0 rezervasyon, 0 kullanıcı, 0 puan, kötüye kullanım yok) |
| G-02 | Yüksek | `POST /reservations` için hız sınırı ve kişi başı tavan yok; ödeme olmadan CONFIRMED rezervasyon açılıyor. Tek hesap tüm filoyu 365 güne kadar kilitleyebilir | `reservations/reservations.controller.ts:198-205` | V2-03 | Düzeltildi (V2-03, #293; saatte 10 istek, hesap başına 3 gelecek rezervasyon) |
| G-03 | Yüksek | `API_ACCESS_KEY` tanımsızsa API açılıyor ve her isteği geçiriyor (SECURITY.md S9 aksini söylüyor). Bugün yalnızca `render.yaml`'ın anahtarı üretmesi koruyor | `config/runtime.ts:27-40`, `common/api-access.ts:25-27` | V2-04 | Düzeltildi (V2-04, #294; `assertRuntimeEnv` anahtarı zorunlu tutar) |
| G-04 | Yüksek | Kampanya kodu tahmin edilebilir: `POST /reservations/price` girişsiz ve sınırsız, cevabı `promo.applied: true/false` söylüyor. Kodda toplam ya da kişi başı kullanım tavanı ve `createdAt` yok (geçerlilik aralığı alanları var ama seed kodları süresiz açıyor) | `reservations/pricing.service.ts:236-239`, `prisma/schema.prisma:308-315` | V2-05 | Düzeltildi (V2-05, #295; kod içeren fiyat isteği 10 dk'da 10 ile sınırlı; toplam tavan (`maxRedemptions`) ve kişi başı tek kullanım (`oncePerUser`) rezervasyon anında kod satırı kilitlenerek denetlenir; cevap kodu ayırt ettirmez) |
| G-05 | Yüksek | Seed canlıda da çalıştırılıyor ([DEPLOY.md](DEPLOY.md) §2). Her çalışmada `NOVERA10` ve `HOSGELDIN` kodlarını süresiz olarak yeniden etkinleştiriyor ve canlı kurların üzerine yazıyor | `prisma/seed.ts:87-101` | V2-05 | Düzeltildi (V2-05, #295; seed var olan kod, kur ve fiyatın üzerine yazmaz; örnek kodlar yalnızca `SEED_DEMO=1` ile gelir) |
| G-06 | Yüksek | Kök `.env.example`'da `USE_MOCKS=1`; dosya Vercel'e olduğu gibi kopyalanırsa ödeme öncesi giriş koruması atlanır ve her kimlik bilgisi "giriş" yapar | `.env.example`, `apps/web/app/[locale]/odeme/actions.ts:58`, `odeme/page.tsx:38`, `lib/auth-actions.ts:110` | V2-06 | Düzeltildi (V2-06, #296; `USE_MOCKS` üretimde açılamaz (`lib/mode.ts`); ödeme öncesi giriş mock modunda da zorunlu; `.env.example`'da boş) |
| G-07 | Orta | `NODE_ENV` tanımsızsa korumalar kapanıyor (fail-open): oturum çerezi `Secure` olmuyor, sıfırlama bağlantıları ve e-posta adresleri günlüğe yazılıyor, `/docs` açılıyor, production açılış kontrolleri atlanıyor | `auth/auth.controller.ts:14`, `auth/reset-link-notifier.ts:67`, `config/runtime.ts` | V2-04 | Düzeltildi (V2-04, #294; `isProduction`: geliştirme yalnızca açık `NODE_ENV=development`) |
| G-08 | Orta | Tarayıcı `/api`'yi hiç çağırmadığı hâlde `next.config.ts`'teki `/api/*` yönlendirmesi duruyor; API web alan adı üzerinden de erişilebilir hâlde (anahtarsız 404 dönse de gereksiz yüzey) | `apps/web/next.config.ts:30-35` | V2-06 | Düzeltildi (V2-06, #296; `next.config.ts`'ten `/api` yönlendirmesi kaldırıldı) |
| G-09 | Orta | API'de doğrulama dört yerde elle yazılmış. Global `ValidationPipe` gövdeler `unknown` olduğu için etkisiz, testlerde hiç kurulmuyor. Kurallar `@ApiBody`'de elle tekrar ediliyor | `src/main.ts:15-21`, `forms/`, `reservations/reservation-input.ts`, `holds/holds.service.ts`, `catalog/` | V2-07 | Düzeltildi (V2-07; şemalar `src/<alan>/*.schemas.ts`, ortak kurallar `common/zod-fields.ts`; `class-validator` kaldırıldı; sözleşme testi `openapi.contract.spec.ts` QuoteRequest'te eksik 4 alanı da yakaladı) |
| G-10 | Yüksek | Web server action'larının çoğu girdiyi doğrulamadan string metodu çağırıyor. Sahte bir istek 500'e yol açıyor; kurallar tarayıcı şemalarından kayabiliyor (ör. parola uzunluğu iki yerde) | `apps/web/lib/auth-actions.ts:96,128-134`, `contact-actions.ts:22-28`, `quote-actions.ts:21-27`, `password-reset-actions.ts:12,34`, `account-actions.ts:56` | V2-08 | Düzeltildi (V2-08, #298; her action girdiyi formun şemasından geçirir, `lib/validation.ts`; parola kuralı tek yerde `passwordField`) |
| G-11 | Orta | Hız sınırı yalnızca 8 uçta ve bellekte; yeniden başlamada sıfırlanıyor. Sınırsız uçlar: katalog okumaları, `/reservations/price`, `/reservations`, `DELETE /holds/:id`, tüm `/me*` (liste §3.2) | `forms/rate-limiter.ts` ve kullananlar | V2-09 | Düzeltildi (V2-09; sayaçlar Postgres'te `RateLimitHit`, global guard her uca sınır koyar, tablo SECURITY.md'de; bellek içi `RateLimiter` kaldırıldı) |
| G-12 | Orta | scrypt N=16384 (OWASP en az 2^17 öneriyor); girişte özet yükseltilmiyor; parola kuralı yalnızca uzunluk (8–128), yaygın parola listesi yok | `auth/password.ts:8` | V2-10 | Düzeltildi (V2-10, #300; scrypt N=2^17, girişte eski özet yeniden yazılır (`needsRehash`); yeni parolada 10.000'lik yaygın parola listesi (`PASSWORD_TOO_COMMON`)) |
| G-13 | Orta | Oturum sabit 30 gün; boşta kalma süresi, `lastUsedAt` ve yenileme yok. Süresi dolan oturum ve sıfırlama bağlantıları yalnızca o kullanıcı giriş yapınca siliniyor | `auth/session-token.ts:4`, `auth/auth.service.ts:111-114` | V2-10 | Düzeltildi (V2-10, #300; oturum 7 gün boşta kalınca biter, `lastUsedAt` 5 dakikada bir güncellenir; günlük temizlik `SessionCleaner`) |
| G-14 | Orta | `DELETE /me` yalnızca çereze bakıyor; çalınan oturum hesabı silebilir (SECURITY.md karar bekleyen 1) | `auth/` me controller | V2-10 | Düzeltildi (V2-10, #300; `DELETE /me` parola (Google hesabında e-posta yazarak onay) ister) |
| G-15 | Düşük | E-posta başına giriş sınırı, başkasının hesabını 15 dakika kilitlemeye izin veriyor (SECURITY.md karar bekleyen 2) | `auth/auth.controller.ts` | V2-10 | Düzeltildi (V2-10, #300; e-posta başına kilit kalktı; 5 yanlıştan sonra artan bekleme (`LoginThrottle`), en çok 15 dk) |
| G-16 | Düşük | Rezervasyon oluştururken tutma (`holdId`) istemci anahtarı denetlenmeden tüketiliyor | `reservations/reservations.service.ts:338-350` | V2-03 | Düzeltildi (V2-03, #293; tutma istemci anahtarıyla eşleşmeli) |
| G-17 | Düşük | Rezervasyon numarası "en büyük + 1" ile, beş denemeyle üretiliyor; ardışık numara rezervasyon hacmini belli ediyor | `reservations/reservations.service.ts:124-131` | V2-11 | Düzeltildi (V2-11; numara Postgres sequence'ten, yeniden deneme döngüsü kalktı; 20 eşzamanlı istekte benzersiz, testle. Seri artık yıl başında sıfırlanmıyor, biçim `NVR-<yıl>-<5 hane>` aynı) |
| G-18 | Düşük | CI'da bağımlılık taraması (`pnpm audit`), Dependabot ve gizli anahtar taraması yok. Prisma CLI içindeki bilinen bulgular (SECURITY.md) izlenmiyor | `.github/workflows/ci.yml` | V2-18 | Düzeltildi (V2-18, #308; `pnpm audit:prod` CI'da, Dependabot, CodeQL; secret scanning ayarı G'de, doğrulanmadı) |
| G-19 | Düşük | `carPhotos/` (167 MB, izlenmeyen) `.gitignore`'da değil; tek bir `git add .` repoya sokar | kök | V2-06 | Düzeltildi (V2-06, #296; `.gitignore`'a `carPhotos/` eklendi) |

### 1.2 Veritabanı (V)

| # | Seviye | Bulgu | Yer | İş | Durum |
|---|---|---|---|---|---|
| V-01 | Orta | `Hold.pickupBranchId` ve `returnBranchId` için yabancı anahtar yok | `prisma/schema.prisma:253-254` | V2-11 | Düzeltildi (V2-11; `Hold_pickupBranchId_fkey`, `Hold_returnBranchId_fkey`, testle) |
| V-02 | Orta | CHECK kısıtı yok: `endAt > startAt`, `percent` 1–90 (yorum "yalnızca seed denetler" diyor), tutarlar ≥ 0, adet ≥ 1 | `schema.prisma` | V2-11 | Düzeltildi (V2-11; `Reservation`/`Hold` için `endAt > startAt`, tutarlar ≥ 0, `days ≥ 1`, `exchangeRate > 0`, ek hizmet adedi ≥ 1, katalog fiyatı ≥ 0; `percent` 1–90 V2-05'te vardı; ihlal testleri `database-integrity.integration.spec.ts`) |
| V-03 | Orta | Eksik indeksler: `Reservation.pickupBranchId`, `returnBranchId`, `ReservationExtra.extraId`, `QuoteRequest.productId`, Rezervasyonlarım için `(userId, startAt)` | `schema.prisma` | V2-11 | Düzeltildi (V2-11; beş indeks eklendi, `Hold` bayi indeksleri de; `(userId, startAt)` eski `userId` indeksini kapsadığı için o kaldırıldı; `EXPLAIN` maliyeti 1182 → 74, PR'da) |
| V-04 | Orta | `updatedAt` eksik: `Reservation` (`cancelledAt` de yok), `QuoteRequest` (durumu değişiyor), tüm katalog tabloları. Panelin çakışma denetimi (ADR-24) bunları gerektirir | `schema.prisma` | V2-11 | Düzeltildi (V2-11; `Reservation.updatedAt` + `cancelledAt`, `QuoteRequest.updatedAt`, `Branch`/`VehicleModel`/`Vehicle`/`Extra` `createdAt` + `updatedAt`; eski satırlar `now()` aldı, eski iptallerin `cancelledAt`'i boş. `FaqItem` V2-17'de kalktı) |
| V-05 | Orta | Migration kayması: `20261017102847` hâlâ `pointsUsed` silme uyarısı taşıyor ama DROP elle çıkarılmış (geliştirme veritabanı şemadan kaymış). İki migration elle yazılmış. CI'da `prisma migrate diff` kontrolü yok | `prisma/migrations/` | V2-11 | Düzeltildi (V2-11; sıfırdan kurulan şema `schema.prisma` ile birebir, kayma yoktu: `20261017102847`'deki uyarı yorumu eski, DROP satırı elle çıkarılmış ve `pointsUsed` kalıyor, dosyaya dokunulmadı. CI'da `prisma migrate diff --exit-code` adımı, bozuk şemada kırmızı) |
| V-06 | Orta | Süresi dolan oturumlar ve sıfırlama bağlantıları için genel temizlik yok; `@@index([expiresAt])` hiç kullanılmıyor | `schema.prisma`, `auth/` | V2-10 | Düzeltildi (V2-10, #300; `SessionCleaner` süresi dolan oturum ve sıfırlama bağlantılarını günlük siler) |
| V-07 | Orta | KVKK saklama süresi yok: iletişim ve teklif kişisel verisi süresiz duruyor. Hesap silinince `QuoteRequest`'te e-posta ve telefon kalıyor (yalnızca `userId` boşalıyor) | `schema.prisma:369-391` | V2-12 | Düzeltildi (V2-12; iletişim mesajı ve teklif talebi 2 yıl sonra günlük görevle anonimleşir (`RetentionTask`), hesap silinince teklifin kişisel alanları hemen silinir, KVKK metni iki dilde güncel, SECURITY.md "Veri saklama") |
| V-08 | Düşük | Puan harcaması defter tablosunda değil `Reservation.pointsUsed`'da; yorum (`:148`, "v1'de puanla ödeme yok") eskimiş. `FaqTopic` değerleri diğer enum'lardan farklı olarak küçük harf Türkçe (enum 27 Ekim'de SSS web'e taşınınca kalktı, V2-17) | `schema.prisma` | V2-11 | Düzeltildi (V2-11; puan defteri bilerek taşınmadı, `Reservation.pointsUsed` kalıyor, yorum düzeltildi; `FaqTopic` zaten V2-17'de kalktı) |
| V-09 | Orta | Ürün/hizmet içeriği iki kopya: çeviri dosyaları ve API tabloları (`Product`, `Service`). Web API'yi hiç çağırmıyor, kopyalar kayabilir | `schema.prisma:334-354`, `content/content.controller.ts:21-37`, `seed.ts:108-122` | V2-17 | Düzeltildi (V2-17, #307; `content` modülü, `/products*`, `/services`, `Service` tablosu ve `Product` metin alanları kalktı, `Product` yalnızca `id` + `slug`; web bu uçları hiç çağırmıyordu; uçlar 404, `app.routes.integration.spec.ts`) |
| V-10 | Orta | Kur güncellemesindeki ±%50 sıçrama koruması, büyük ve gerçek bir harekette kurları kalıcı olarak kilitleyebilir. `FALLBACK_RATES` iki yerde kopya | `catalog/rates-updater.service.ts:119-121`, `catalog.service.ts:9`, `pricing.service.ts:19` | V2-13 | Düzeltildi (V2-13; büyük sıçrama `RateCandidate` olarak bekletilir, aynı yönde üçüncü gün gelirse kabul edilir; reddedilen değer günlüğe yazılır; `FALLBACK_RATES` `common/money.ts`'te) |

### 1.3 Mimari ve clean code (M)

| # | Seviye | Bulgu | Yer | İş | Durum |
|---|---|---|---|---|---|
| M-01 | Orta | API'de ortak yardımcılar yanlış yerde ve kopya. `RateLimiter`, `clientKeyOf` ve `FormReader` `forms/` içinde ama auth ve holds kullanıyor (V2-07 ve V2-09 sonrası `FormReader` ve `RateLimiter` kalktı, `clientKeyOf` `common/client-key.ts`'te). Kopyalar: UUID regex ×3, 30 dk dilim kontrolü ×3, `isUniqueViolation` ×4, `validationFailed` ×2, `PASSWORD_MIN/MAX` ×3, `HOUR_MS/DAY_MS` ×6, çakışma kuralı ×3, `getRate/toMoney` ×2, isteğe bağlı oturum okuma ×2 | `src/holds`, `src/reservations`, `src/catalog`, `src/forms` | V2-13 | Düzeltildi (V2-13, #303; UUID, `isUniqueViolation`, `validationFailed`, `PASSWORD_MIN/MAX`, `HOUR_MS/DAY_MS`, `getRate/toMoney/convertMinor`, `FALLBACK_RATES` tek tanım: `common/uuid.ts`, `prisma-errors.ts`, `zod-validation.ts`, `zod-fields.ts`, `time.ts`, `money.ts`; çakışma kuralı `common/availability.ts`; isteğe bağlı oturum okuma `userOfRequest`; `grep` çıktısı PR'da) |
| M-02 | Düşük | `ConfigModule` içe aktarılmış ama kullanılmıyor; `process.env` yaklaşık 8 dosyada doğrudan okunuyor | `src/` | V2-13 | Düzeltildi (V2-13; `process.env` yalnızca `config/env.ts`'te okunur, `ConfigModule` ve `@nestjs/config` kalktı, `.env` `main.ts`'te `dotenv/config` ile yüklenir) |
| M-03 | Düşük | İskelet artıkları ve tip açıkları: canlıda `GET /` "Hello World", CI'da çalışmayan eski `test/app.e2e-spec.ts`, `catalog.service.ts:135,299`'da `any` (biri yanlış tipte), `tx as unknown as …` dönüşümleri, kullanılmayan `@nestjs/mau`, `.js` uzantısız importlar, karışık satır genişliği | `src/app.controller.ts`, `test/`, `catalog.service.ts`, `reservations.service.ts:102-114` | V2-13 | Düzeltildi (V2-13; `GET /` 404, `test/app.e2e-spec.ts` ve `@nestjs/mau` kalktı, `any` yok, `tx as unknown as` yerine `Db<…>` işlem tipi, `.js` uzantıları, tek Prettier ayarı (genişlik 120) ayrı commit'te) |
| M-04 | Düşük | Uzun dosyalar: `catalog.service.ts` 369 satır; dört spec 375–434 satır | `src/catalog`, `src/reservations`, `src/holds` | V2-13 | Düzeltildi (V2-13; `catalog.service.ts` → `catalog.service.ts` + `availability.service.ts`; dört uzun spec'in kurulumu `*.testing.ts`'e çıktı, hiçbir spec 375 satırı aşmıyor, test sayısı aynı) |
| M-05 | Orta | Web'de API altyapısı kopya: `api-post.ts` `api-request.ts`'i tekrarlıyor ve `SESSION_COOKIE`'yi yeniden tanımlıyor. Tema ve para birimi çerez yazımı üç yerde | `apps/web/lib/api-post.ts:16`, `auth-actions.ts:46-47,113-114`, `preferences-actions.ts:30-31` | V2-14 | Düzeltildi (V2-14, #304; `api-post.ts` kalktı, `apiPost` `apiRequest`'in ince bir katmanı, `SESSION_COOKIE` yalnızca `session-cookie.ts`'te; tema ve para birimi çerezleri `setPreferenceCookies` ile tek yerde) |
| M-06 | Yüksek | Mock modu dağınık: `USE_MOCKS` 23 dosyada ~45 kez okunuyor, `mocksEnabled` dört kez tanımlı. Öncelik tutarsız (bazı akışlar `API_URL`'e, bazıları `USE_MOCKS`'a önce bakıyor). Mock verisi sunucu koduna statik olarak giriyor | `lib/account-actions.ts:21`, `account-server.ts:16`, `auth-actions.ts:24`, `fleet-client.ts:34`, `session.ts:4` | V2-06 | Düzeltildi (V2-06, #296; `USE_MOCKS` yalnızca `lib/mode.ts`'te okunur; mock verisi yalnızca mock modunda dinamik `import()` ile yüklenir) |
| M-07 | Düşük | Web'de kopyalar: dil adları haritası iki kez; masaüstü ve mobilde iki ayrı dil/para birimi arayüzü; `branch-explorer.tsx` 14 hook ile bölünmeye aday | `components/profile/preferences-form.tsx:15`, `components/locale-switcher.tsx:12`, `branch-explorer.tsx` | V2-14 | Düzeltildi (V2-14; `LANGUAGE_NAMES` `lib/languages.ts`, `useLocaleLinks` ve `useCurrencyChoice` ortak mantık, `branch-explorer.tsx` 287 → 240 satır, durumu `use-branch-explorer.ts`'te) |
| M-08 | Orta | Token lint kuralı yalnızca uyarı veriyor ve regex'inde boşluk var (`grid-cols-[10rem_1fr]`, `w-[min(44rem,…)]`, `w-[calc(100%-2rem)]` geçiyor). 77 rastgele değer var. `apple-icon` ve `opengraph-image` ham hex kullanıyor | `eslint.config.mjs:8`, `app/apple-icon.tsx:10`, `app/opengraph-image.tsx:17` | V2-14 | Düzeltildi (V2-14; kural **error**, regex köşeli parantez içindeki renk, uzunluk birimi ve yüzdeyi her yerde yakalar; 14 değer `globals.css`'teki adlı `@utility` sınıflarına taşındı; `apple-icon` ve `opengraph-image` `BRAND_COLORS` kullanıyor) |
| M-09 | Düşük | `@types/node ^20` (motor `>=22`, `.nvmrc` 24). `framer-motion` paketi artık `motion` adıyla yayımlanıyor. `driver-section.tsx:104` bir `exhaustive-deps` kuralını kapatıyor | `apps/web/package.json`, `components/booking/driver-section.tsx` | V2-14 | Düzeltildi (V2-14; `@types/node` ^24, `framer-motion` → `motion`, `driver-section` kapatılmış kural yerine `useEffectEvent`) |
| M-10 | Düşük | `AuthRateLimitedError` mesajı "Too many password reset requests" ama giriş, kayıt ve Google sınırlarında da fırlatılıyor | `apps/web/lib/auth-client.ts:88` | V2-08 | Düzeltildi (V2-08, #298; mesaj genelleşti) |

### 1.4 UI/UX ve bilgi mimarisi (U)

| # | Seviye | Bulgu | Yer | İş | Durum |
|---|---|---|---|---|---|
| U-01 | Orta | Ana kurumsal dönüşüm sayfası `/kurumsal-teklif` navbar'da da footer'da da yok; yalnızca sayfa içi düğmelerden ulaşılıyor | `components/layout/nav-items.ts`, `site-footer.tsx` | V2-16 | Düzeltildi (V2-16, #306; footer "Keşfet" sütununa "Kurumsal teklif", Ürünler açılır menüsünün altına ve mobil menüde Ürünler'in altına "Teklif alın"; navbar'a yeni üst düzey öğe eklenmedi. **G'nin menü onayı PR'da bekliyor**) |
| U-02 | Düşük | `/kvkk` ve `/gizlilik-politikasi` ikisi de gizlilik metni; ayrımları sayfada anlatılmıyor ve birbirine bağlantı vermiyorlar | `app/[locale]/kvkk`, `gizlilik-politikasi` | V2-16 | Düzeltildi (V2-16; `/kvkk` ve `/gizlilik-politikasi` ayrı kaldı, her biri başında farkı anlatan bir cümle ve diğerine bağlantı taşıyor, TR/EN `legal.json`) |
| U-03 | Orta | Rezervasyon kartları fotoğraf yerine hep yer tutucu gösteriyor (`imageUrl={null}` sabit) | `components/profile/reservation-list.tsx:86` | V2-16 | Düzeltildi (V2-16; `Reservation.vehicle.imageUrl` API cevabındaki modelden geliyor, mock'ta da; kartlar fotoğrafı gösteriyor, fotoğrafı olmayan araç yer tutucuda kalıyor) |
| U-04 | Düşük | Hizmetler sayfasındaki yorum eskimiş: header menüsü hizmete bağlantı vermiyor, güvence bandı `hizmet=1`'e gidiyor | `app/[locale]/hizmetler/page.tsx:24`, `guarantee-band.tsx:43` | V2-16 | Düzeltildi (V2-16; `hizmetler/page.tsx` yorumu güncel: header'ın Hizmetler öğesi düz bağlantı, güvence bandı `hizmet=1`'e gider) |
| U-05 | Orta | Ekran okuyucu turu hiç yapılmadı; v1'in tasarım eleştirisi sayfa sayfa yapılmadı (yalnızca ölçüm: axe, taşma, klavye) | — | V2-20 | Kısmen kapatıldı (V2-20, #310 kapandı: otomatik tur yapıldı, 20 sayfa × 5 genişlik × açık/koyu × TR/EN, taşma 0, axe 0, `responsive.spec.ts` genişletildi). NVDA + Chrome ekran okuyucu turu ve `impeccable`/`web-design-guidelines` eleştirisi bilerek ertelendi; Faz 2 kapanışından (V2-22) önce yapılacak, yapılmadan U-05 tam kapanmış sayılmaz |
| U-06 | Düşük | Web manifest yalnızca SVG ve 180 px ikon içeriyor; 192/512 px PNG, maskable ikon, `id`, `scope` yok. Telefonda "ana ekrana ekle" deneyimi zayıf | `app/manifest.ts` | V2-16 | Düzeltildi (V2-16; manifest'e 192 ve 512 px PNG, maskable ikon (`app/icons/[file]/route.tsx`, `BRAND_COLORS`'tan), `id`, `scope`; Chrome `Page.getAppManifest` hata ve yüklenebilirlik uyarısı boş) |

### 1.5 Performans (P)

| # | Seviye | Bulgu | Yer | İş | Durum |
|---|---|---|---|---|---|
| P-01 | Yüksek | `NextIntlClientProvider` `messages` almadığı için her sayfa tüm çeviri dosyalarını (yaklaşık 129 KB, yalnız `legal.json` 15 KB) istemciye gönderiyor | `app/[locale]/layout.tsx:61` | V2-15 | Düzeltildi (V2-15, #305; kök provider yalnızca üstbilgi, çerez bandı ve hata sayfası metnini gönderir (`ROOT_NAMESPACES`), her bölüm kendi istemci bileşenlerinin metnini `ClientMessages` ile ekler; liste `i18n/client-messages.ts`, `tests/client-messages.test.ts` kodu okuyup listeyle karşılaştırır; ana sayfa HTML'i 469 → 413 KB, `/araclar` 278 → 210 KB (gzip 44 → 24 KB)) |
| P-02 | Orta | `framer-motion` navbar menüsü üzerinden her sayfada yükleniyor; etkiler CSS ile yapılabilir | `components/layout/nav-menu.tsx`, `main-nav.tsx` | V2-14 | Düzeltildi (V2-14; navbar paneli CSS (`animate-menu-in`); `framer-motion` artık yalnızca SSS ve iletişim bağlantısı olan sayfalarda yüklenir; ölçüm PR'da) |
| P-03 | Orta | İlk araç görselinde `preload` yok (Next 16'da `priority`'nin yerine geçti); 4 modelin fotoğrafı eksik; fotoğraflar sıkıştırılmadı | `components/vehicle/vehicle-image.tsx`, `public/` | V2-21 | Kısmen (V2-21, #311; `VehicleImage` `preload` alıyor, sonuç listesinin ilk kartı kullanıyor; 4 fotoğraf bütçeye indirildi. **Eksik 4 modelin fotoğrafı G'nin `carPhotos/` seçimini bekliyor**, açık) |
| P-04 | Orta | Production build'de mobil Lighthouse hiç ölçülmedi (v1'deki sayılar geliştirme sunucusundan, geçersiz) | — | V2-21 | Ölçüldü, hedef tutmadı (V2-21, #311; [PERFORMANCE.md](PERFORMANCE.md): LCP dört sayfada 2,8–4,4 sn > 2,5 sn, TBT üç sayfada > 200 ms, CLS hedefte. Neden: hidrasyon maliyeti. Sonraki adım PERFORMANCE.md'de; açık) |

### 1.6 Test ve CI (T)

| # | Seviye | Bulgu | Yer | İş | Durum |
|---|---|---|---|---|---|
| T-01 | Orta | Playwright her zaman `USE_MOCKS=1` ile çalışıyor; gerçek API kod yolunun uçtan uca testi yok | `apps/web/playwright.config.ts:43` | V2-19 | Düzeltildi (V2-19, #309; `playwright.smoke.config.ts` + `smoke/booking.spec.ts` (`smoke-api` projesi): API ve site build'i, tohumlanmış veritabanı, `USE_MOCKS` yok; kayıt → arama → Kirala → özet → ödeme → onay → Rezervasyonlarım → iptal, 1280 px, yerelde ~12 sn. CI'da ayrı adım `Smoke test against the real API`; API'nin veritabanı bilerek bozulunca kırmızı (çıkış kodu 1)) |
| T-02 | Orta | Uçtan uca testlerde axe yok (v1'de ayrı bir betikle ölçüldü) | `apps/web/e2e/` | V2-19 | Düzeltildi (V2-19; `@axe-core/playwright`, `e2e/axe.ts`; `e2e/fixtures.ts` her testin bittiği sayfada WCAG 2.2 AA taraması yapar, `messages.spec.ts` sitemap'teki her sayfayı iki dilde; `e2e/axe.spec.ts` bilerek bozulan kontrastın kırmızı yaptığını gösterir. Taramanın bulduğu 4 gerçek ihlal düzeltildi: dil düğmesi adı (WCAG 2.5.3), şehir seçicilerde boş listbox ve eksik `aria-controls`) |
| T-03 | Orta | API test boşlukları: katalog (bayiler, modeller, ek hizmetler, kurlar), `device.ts`, `user-view.ts`, doğrulama pipe'ının HTTP davranışı, geçmiş tarihli rezervasyon, rezervasyon hacmi | `apps/api/src/` | V2-19 | Düzeltildi (V2-19; katalog (bayiler, modeller, ek hizmetler, kurlar, araç arama ve 422'leri) ve rezervasyon (alma, geçmiş tarih regresyonu, 120 kayıtlı geçmiş, iptal ve `cancelledAt`, başkasının kaydı 404) HTTP testleri gerçek PostgreSQL'e karşı tüm uygulamada; `device.ts` ve `user-view.ts` birim testleri) |
| T-04 | Düşük | CI'da migration kayma kontrolü, `pnpm audit` ve bağımlılık güncelleme botu yok | `.github/workflows/ci.yml` | V2-11, V2-18 | Düzeltildi (audit ve güncelleme botu: V2-18, #308; migration kayma kontrolü: V2-11, CI adımı `Check migrations against the schema`) |
| T-05 | Orta | e2e: sayfa React tarafından hidrate edilmeden tıklayan ya da üzerine gelen testler tam paket koşusunda (özellikle CI'da) arada düşüyor: işleyici henüz bağlı olmadığı için menü ya da balon hiç açılmıyor. 24-25 Ekim'de `main`'de ve iki PR'da CI'ı kırdı (`contact-link`, `branches`, `header`). Gerçek ürün hatası değil, testin yarışı | `apps/web/e2e/` | V2-19 | Düzeltildi (kararsız çıkan testler için; `e2e/hydration.ts` yardımcısı `hydrated()`, kanıtı `e2e/hydration.spec.ts`). Diğer e2e testleri aynı deseni taşıyabilir: V2-19'da yeni test yazarken ve axe turunda `hydrated()` kullanılır |

### 1.7 Sağlam bulunanlar (korunacak)

- **Hata biçimi:** her yerde aynı; stack trace sızmıyor.
- **Yetki:** IDOR süzgeçleri tutarlı.
- **Eşzamanlılık:** araç ve kullanıcı satırı kilitleri hep aynı sırayla alınıyor; sıfırlama belirteci `updateMany` ile tek kullanımlık.
- **Fiyat:** yalnızca sunucuda hesaplanıyor. Para alt birim tam sayısıyla, kur `Decimal` olarak saklanıyor.
- **Sorgular:** ham SQL parametreli. Sınırlayıcının belleği sınırlı.
- **CI:** entegrasyon testlerini gerçek Postgres'le koşuyor.
- **Seed ve şema:** seed sabit UUID'li ve tekrar çalıştırılabilir. Yabancı anahtarların çoğunda indeks var; `onDelete` seçimleri yerinde.
- **Web güvenliği:**
  - açık yönlendirme yok;
  - tek `dangerouslySetInnerHTML` kaçışlı JSON-LD;
  - istek başına nonce'lu CSP (`strict-dynamic`), HSTS;
  - oturum çerezi httpOnly/Secure/Lax;
  - yalnızca açık olması gereken üç `NEXT_PUBLIC_` değişkeni var;
  - repoda gizli anahtar yok.
- **Web kodu:**
  - çeviri disiplini tam (gömülü metin yok);
  - token kullanımı neredeyse tam;
  - veri gösteren sayfalarda yükleniyor/boş/hata durumları var;
  - el yazısı kodda `any` yok;
  - yığın güncel (Next 16.3, React 19.2, Tailwind 4, zod 4, Playwright 1.64).

---

## 2. Bulgu → iş haritası

| İş | Kapattığı bulgular |
|---|---|
| V2-02 | G-01 |
| V2-03 | G-02, G-16 |
| V2-04 | G-03, G-07 |
| V2-05 | G-04, G-05 |
| V2-06 | G-06, G-08, G-19, M-06 |
| V2-07 | G-09 |
| V2-08 | G-10, M-10 |
| V2-09 | G-11 |
| V2-10 | G-12, G-13, G-14, G-15, V-06 |
| V2-11 | G-17, V-01, V-02, V-03, V-04, V-05, V-08, T-04 (kayma) |
| V2-12 | V-07 |
| V2-13 | M-01, M-02, M-03, M-04, V-10 |
| V2-14 | M-05, M-07, M-08, M-09, P-02 |
| V2-15 | P-01 |
| V2-16 | U-01, U-02, U-03, U-04, U-06 |
| V2-17 | V-09 |
| V2-18 | G-18, T-04 (audit, bot) |
| V2-19 | T-01, T-02, T-03 |
| V2-20 | U-05 (ve turda bulunacak yeni U-xx'ler) |
| V2-21 | P-03, P-04 |
| V2-22 | Faz 2 kapanış kapısı: bu belgenin tamamı |

---

## 3. Denetim kontrol listeleri

İlgili issue'da işaretlenir; işaretlenmeyen madde ya bulgu olarak §1'e yazılır ya da gerekçesiyle "uygulanmaz" denir.

### 3.1 Güvenlik (OWASP ASVS 4.0 Seviye 1'den uygulanabilir maddeler)

- [ ] **Kimlik:**
  - parola en az 8 karakter (yönetici 12) ve yaygın parola listesine karşı denetim;
  - özet scrypt N ≥ 2^17 ya da argon2id;
  - girişte özet yükseltme;
  - kaba kuvvete karşı hesap ve istemci sınırı.
- [ ] **Oturum:** rastgele 256 bit; yalnızca özeti saklanır; httpOnly/Secure/SameSite; mutlak ve boşta kalma süresi; çıkışta ve parola değişince iptal.
- [ ] **Erişim:** her uçta yetki API'de; IDOR testleri; yönetici ve şirket izolasyon testleri; en az yetki.
- [ ] **Girdi:** her uçta şema doğrulaması (ADR-26); gövde boyut sınırı; yalnızca JSON kabul edilen uçlarda `415`.
- [ ] **Çıktı:** ham HTML yok; JSON-LD kaçışlı; hata metninde iç ayrıntı yok.
- [ ] **İş mantığı:**
  - zaman kuralları (geçmiş tarih, en uzun süre);
  - tavanlar (aktif rezervasyon, kampanya kodu kullanımı);
  - puan kuralları sunucuda;
  - geçersiz durum geçişi reddedilir.
- [ ] **Hız sınırı:** her uç §3.2 tablosunda; `429` + `Retry-After`.
- [ ] **Dosya:** tür imzayla, boyut sınırı, rastgele ad, EXIF temizliği, izinli alan adı (ADR-28).
- [ ] **Yapılandırma:** production'da eksik gizli değerle açılmama (fail-closed); `/docs` kapalı; güvenlik başlıkları; CSP.
- [ ] **Veri koruma:** kişisel veri günlüğe yazılmaz; saklama süreleri (V2-12); yedekler repoda değil.
- [ ] **Bağımlılıklar:** `pnpm audit --prod` CI'da; bot güncellemeleri; bilinen bulguların gerekçeli kaydı.
- [ ] **Denetim kaydı:** yönetici ve Filom'da değiştiren işlemler (ADR-24).

### 3.2 Hız sınırı tablosu (ADR-27)

22 Ekim durumu ve hedef. V2-09'dan sonra tek kaynak [SECURITY.md](SECURITY.md)'dir; bu tablo tarihsel kayıt olarak kalır.

| Uç | Bugün | Hedef |
|---|---|---|
| `POST /auth/register` | 10/saat/istemci | Aynı |
| `POST /auth/login` | 10/15 dk/istemci + 10/15 dk/e-posta | İstemci aynı; e-posta sınırı aşılınca kilit yerine artan bekleme (G-15) |
| `POST /auth/google` | 10/15 dk/istemci | Aynı |
| `POST /auth/forgot-password` | 5/saat/istemci + 3/saat/e-posta | Aynı |
| `POST /auth/reset-password` | 10/15 dk/istemci | Aynı |
| `POST /me/password` | 5/15 dk/kullanıcı | Aynı |
| `POST /contact`, `POST /quotes` | 10/saat/istemci | Aynı |
| `POST /holds` | En çok 5 etkin tutma/istemci | Aynı + 30/saat/anahtar |
| `POST /reservations/price` | 60/10 dk/istemci (V2-03) | 60/10 dk/anahtar; kampanya kodu içeren istek 10/10 dk/anahtar (G-04) |
| `POST /reservations` | 10/saat/kullanıcı + en çok 3 gelecek rezervasyon (V2-03) | Aynı; V2-09 kalıcı depoya taşır |
| Katalog okumaları, `/rates` (`/faq` 27 Ekim'de kalktı) | Yok | Varsayılan: 300/5 dk/anahtar |
| `/me*` (okuma) | Yok | Varsayılan |
| `PATCH /me`, `DELETE /me`, iptal, oturum kapatma | Yok | 20/15 dk/kullanıcı |
| `/admin/*` | — | 120/dk/yönetici |
| `/fleet/*` | — | Okuma varsayılan; yazma 60/10 dk/kullanıcı |
| Talep oluşturma (`POST /fleet/requests`) | — | 20/saat/şirket |

### 3.3 Veritabanı

- [ ] Her yabancı anahtar FK'li ve indeksli; sık süzülen sütunlarda indeks (`EXPLAIN` ile Rezervasyonlarım ve müsaitlik sorguları).
- [ ] İş kuralları CHECK ile (tarih aralığı, yüzde, tutar ≥ 0, adet ≥ 1); benzersizlik indeksle (plaka, kod, aracın tek açık zimmeti).
- [ ] Değişen her tabloda `createdAt` ve `updatedAt`; durum değişen tablolarda zaman damgası (`cancelledAt`, `closedAt`, `disabledAt`).
- [ ] Silme politikası: iş geçmişi taşıyan kayıt silinmez, pasifleşir (bayi, model, araç, kod); kişisel veri saklama süresi dolunca anonimleşir.
- [ ] Migration'lar şemayla birebir (`prisma migrate diff --exit-code` CI'da); elle yazılan migration PR'da gerekçeli.
- [ ] Seed canlıda yalnızca eksik referans verisini ekler; var olan iş verisinin (kod, kur, fiyat) üzerine yazmaz.

### 3.4 Arayüz, responsive ve erişilebilirlik

- [ ] Her sayfa 320, 375, 768, 1024, 1280 px'te; yatay kaydırma yok (`e2e/responsive.spec.ts` genişletilir).
- [ ] WCAG 2.2 AA: kontrast, 44 px dokunma hedefi, görünür odak, klavye ile tam akış, odak sırası, `prefers-reduced-motion`.
- [ ] axe her e2e sayfasında sıfır ihlal; ekran okuyucu (NVDA + Chrome) turu: kiralama, teklif, giriş, panelde bir liste + form, Filom'da zimmet.
- [ ] [DESIGN.md](DESIGN.md) kurallarına uyum (tek birincil düğme, tutarlı bileşenler, token dışı değer yok); tasarım eleştirisi `impeccable` ve `web-design-guidelines` becerileriyle.
- [ ] Her veri ekranında yükleniyor, boş, hata durumu.

### 3.5 Performans

- [ ] Production build + gizli pencere, mobil Lighthouse: ana sayfa, `/araclar`, `/urunler/akilli-kurumsal-filo`, `/bayilerimiz`.
- [ ] LCP < 2,5 sn, INP < 200 ms, CLS < 0,1; LCP görseli `preload`; görseller WebP/AVIF ve `sizes`.
- [ ] İstemciye giden çeviri ve JS yükü sayfa başına ölçülür (`next build` çıktısı), PR'da önce/sonra.

### 3.6 Kod düzeni

- [ ] Ortak yardımcı tek yerde (`common/`, `lib/`); kopya kural yok.
- [ ] Yapılandırma tek modülden, tipli (`ConfigModule` ya da tek `env.ts`).
- [ ] `any` yok, gereksiz tip dönüşümü yok; 300 satırı aşan el yazısı dosya bölünür (spec dosyaları yardımcılara ayrılır).
- [ ] Yorumlar "neden"i anlatır; ölü kod ve iskelet artığı yok.

---

## 4. Kalite kapıları (Definition of Done)

Her PR için (ayrıntı [WORKFLOW.md](WORKFLOW.md)):

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` yerelde geçti ve çıktısı PR'da.
2. CI yeşil: lint, tip, test, build, link kontrolü, e2e, audit.
3. Issue'daki kabul kriterlerinin her biri işaretli ve nasıl doğrulandığı yazılı.
4. Arayüz değiştiyse 375 ve 1280 px ekran görüntüsü; panel ekranıysa ayrıca 768.
5. Yeni uçta: şema doğrulaması, hız sınırı satırı, yetki testleri (401/403/404), `openapi.yaml` güncel.
6. Yeni metin hem `tr` hem `en` dosyasında.
7. Bu belgede kapanan bulgunun durumu güncel.
8. G Vercel önizlemesinde kabul kriterlerini denedi.
