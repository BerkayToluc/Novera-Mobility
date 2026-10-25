# Novera Mobility: Mimari (ARCHITECTURE)

> Durum: **v2.0** · 22 Ekim 2026 · Karar sahibi: G (PM), uygulayan: Berkay.
> v1'in ADR'lerinin tam metni (bağlam, alternatifler, ödünleşim) [archive/v1/ARCHITECTURE.md](archive/v1/ARCHITECTURE.md) içindedir; aşağıda özetleri ve bugünkü durumları var. v2'nin yeni kararları ADR-24'ten başlar.
> Her karar *Bağlam / Karar / Sonuçları* düzenindedir. Bir karar değişirse burada güncellenir, eski hâli "Değiştirildi" notuyla kalır.

---

## 1. Sistem bugün

```
 Tarayıcı ──HTTPS──▶ apps/web (Next.js 16, Vercel)
                      │  Sayfalar, sunucu bileşenleri, server action'lar, CSP nonce (proxy.ts)
                      │  API'yi YALNIZCA sunucudan çağırır (lib/api-request.ts, api-post.ts)
                      │  Başlıklar: X-Novera-Key (paylaşılan gizli anahtar), X-Novera-Client-IP,
                      │             Cookie: novera_session (API'nin çerezi web'e kopyalanır)
                      ▼
                     apps/api (NestJS 12, Render Free, Frankfurt)
                      │  Modüller: auth, catalog, holds, reservations, forms, content, health, common
                      │  Anahtarsız istek 404 · hata biçimi {code, message, fieldErrors}
                      ▼
                     PostgreSQL 17 (Neon Free, Frankfurt) ── Prisma 7

 Yan servisler: Resend (e-posta, HTTPS) · UptimeRobot (/health, 5 dk) · Google Maps JS (tarayıcıdan) ·
                Google Identity (Google ile giriş, ID token API'de doğrulanır) · günlük kur güncelleme görevi
```

- **Tek dil:** TypeScript (web ve API). Monorepo, pnpm workspaces; `packages/` bugün boş.
- **Web:** `app/[locale]/...` (next-intl, TR öneksiz, EN `/en`), `components/<özellik>/`, `lib/` (API istemcileri, action'lar, şemalar), `mocks/` (yalnızca `USE_MOCKS=1`), `messages/tr|en/<özellik>.json`. Testler: `tests/` (Vitest), `e2e/` (Playwright).
- **API:** `src/<alan>/` (controller + service + spec), `prisma/schema.prisma`, `prisma/migrations/` (11 migration), `prisma/seed.ts` (sabit UUID'li, tekrar çalıştırılabilir).
- **Sözleşme:** `docs/api/openapi.yaml`; web tipleri `pnpm --filter @novera/web gen:api` ile `lib/api-types.ts`'e üretilir.
- **CI** (`.github/workflows/ci.yml`): Postgres servisli; lint, typecheck, test, build, iç link kontrolü, Playwright (örnek veriyle).

## 2. v1 kararları (ADR-01–23) ve bugünkü durum

| ADR | Karar | Bugünkü durum (22 Ekim) |
|---|---|---|
| 01 | Monorepo, pnpm workspaces | Geçerli |
| 02 | Next.js App Router + TypeScript | Geçerli (Next 16.3) |
| 03 | Tailwind + tasarım token'ları, bileşende ham değer yok | Geçerli; lint kuralında boşluk var (QUALITY M-08) |
| 04 | next-intl, özellik başına çeviri dosyası | Geçerli; tüm metinler her sayfada istemciye gidiyor (P-01) |
| 05 | NestJS, alan başına modül, Swagger | Geçerli; Swagger canlıda kapalı |
| 06 | PostgreSQL + Prisma | Geçerli |
| 07 | Sözleşme önce, mock | Geçerli; mock modu dağınık (M-06), ADR-29 ile toplanır |
| 08 | E-posta + şifre, httpOnly çerez | Geçerli; özet `argon2` değil **scrypt**; Google ile giriş eklendi |
| 09 | Google Maps JS API | Geçerli; v2'de Filom haritaları da bunu kullanır |
| 10 | Formlar React Hook Form + Zod; API class-validator | **Değişiyor:** API'de doğrulama elle yazılmış, class-validator kullanılmıyor. ADR-26 ile iki tarafta da zod |
| 11 | ESLint, Prettier, Vitest, Playwright, Actions | Geçerli; v2'de CI'a güvenlik taraması eklenir (V2-18) |
| 12 | Yayın: Vercel + Render + Neon | Geçerli ([DEPLOY.md](DEPLOY.md)) |
| 13 | Tema çerezi + `data-theme`, sayfalar istek anında | Geçerli |
| 14 | API'ye Next üzerinden erişim | **Değişti:** tarayıcı API'yi hiç çağırmıyor, tüm çağrılar sunucudan; `next.config.ts`'teki `/api` yönlendirmesi artık gereksiz ve V2-06'da kalkar |
| 15 | TRY/EUR/USD, kur backend'de | Geçerli; Filom tutarları yalnızca TRY |
| 16 | API UTC, ekran `Europe/Istanbul`, 30 dk dilim | Geçerli |
| 17 | Sözleşme kuralları: hata biçimi, iki dilli alan, alt birim tutar, sayfalama yok | Geçerli; `/admin/*` ve `/fleet/*` için istisnalar ADR-24 |
| 18 | SEO: meta, robots, sitemap, JSON-LD | Geçerli |
| 19 | Kendi çerez onayı, çerezsiz analytics | Geçerli; analytics aracı hâlâ açık karar |
| 20 | Formlar sunucu action'ı ile, tuzak alan, KVKK onayı | Geçerli; action'larda zod eksik (G-10) |
| 21 | Animasyon kütüphanesi yok | **Değişti (v1 SPEC v0.7):** `framer-motion` 3 dosyada kullanılıyor; navbar'daki kullanım V2-14'te CSS'e döner |
| 22 | Filo penceresi `<dialog>` + `?arac=` | Geçerli |
| 23 | Markalı 404 ve 500 | Geçerli |

---

## 3. v2 kararları

### ADR-24 · Yönetim paneli web uygulamasının içinde

- **Bağlam:** Novera çalışanı katalog, operasyon ve kurumsal müşteri verisini koddan bağımsız yönetmeli ([ADMIN.md](ADMIN.md)). Ekip tek geliştiricidir.
- **Karar:**
  - Panel `apps/web/app/[locale]/yonetim` altındadır (EN `/en/admin`). Aynı token'ları, çeviri düzenini, oturum çerezini ve sunucu tarafı API çağrısını kullanır. Ayrı uygulama ya da hazır yönetim aracı kullanılmaz.
  - **Yetki API'dedir:** `User.role` (`CUSTOMER` varsayılan, `ADMIN`) ve `/admin/*` önünde `AdminGuard`. Web'deki rol kontrolü yalnızca yönlendirme içindir; rolü olmayan kullanıcıya sayfa 404 döner.
  - Yönetici hesabı yalnızca komut satırından açılır (`pnpm admin:create`, `--revoke`). Oturumu 12 saattir, Google ile giremez, parolası en az 12 karakterdir. Rol geri alınınca açık oturumları kapanır.
  - Değiştiren her istek `AuditLog`'a yazılır: aktör, şirket (Filom'dan geliyorsa), eylem, varlık, kimlik ve değişen alan **adları**. Değerler yazılmaz.
  - **ADR-17'den farklar** (yalnızca `/admin/*` ve `/fleet/*`):
    - Listeler sayfalıdır: `?page=&pageSize=` (en çok 100), cevap `{ items, total, page, pageSize }`; sıralama `?sort=alan:asc|desc`.
    - Süzme sunucuda yapılır.
    - Düzenleme isteği kaydın `updatedAt` değerini taşır; arada değişmişse cevap `409 STALE_WRITE` olur.
    - Yeni hata kodları: `FORBIDDEN` (403), `STALE_WRITE`, `IN_USE`, `INVALID_TRANSITION`, `ALREADY_GENERATED`, `VEHICLE_ASSIGNED` (409), `UNSUPPORTED_MEDIA_TYPE` (415).
  - Önbellek: herkese açık katalog uçlarını (bayiler, modeller, ek hizmetler) web etiketle önbelleğe alır (`branches`, `vehicle-models`, `extras`). Panelde kayıt yapan action `revalidateTag` çağırır.
- **Sonuçları:** panel kodu sitenin derlemesine girer ama yalnızca `/yonetim` rotalarında yüklenir. Tek oturum, tek yayın, tek tasarım düzeni olur; tek geliştirici için en az iş budur.

### ADR-25 · Şirket modeli ve Filom

- **Bağlam:** kurumsal müşteri kendi filosunu görmeli ve yönetmeli; veriyi Novera girer ([FLEET.md](FLEET.md)).
- **Karar:**
  - Yer: `apps/web/app/[locale]/filom` (EN `/en/my-fleet`). ADR-24'ün ortak liste ve form bileşenleri kullanılır.
  - Yeni `Company` modeli eklenir. Kurumsal `User` kaydı `companyId` ile bağlanır. Bugün `User` üzerindeki firma alanları migration'la `Company`'ye taşınır; `GET /me` cevabının biçimi değişmez.
  - Uzun dönem filo araçları **ayrı tablodadır** (`FleetVehicle`). Kiralık `Vehicle`'dan ayrıdır; müsaitlik ve arama kodu filo araçlarını hiç görmez.
  - `/fleet/*` uçları `CompanyGuard` arkasındadır (oturum + kurumsal hesap + `companyId`). Her sorgu `companyId` ile süzülür; başka şirketin kaydı `404` döner. Kimlikler uuid'dir.
  - Türetilen değerler saklanmaz, sorgu anında hesaplanır: faturanın "gecikti" durumu, masrafın personeli (zimmetten), rapor toplamları.
  - Filom tutarları TRY alt birimdedir; ADR-15'in para birimi çevirisi uygulanmaz.
- **Sonuçları:** `Company`'ye taşıma mevcut kurumsal hesaplara dokunan bir migration'dır ve testle korunur. Bir araç aynı anda hem kiralık hem filo olamaz; v2'de bu gerekmiyor.

### ADR-26 · Girdi doğrulama: iki tarafta da zod

- **Bağlam:** API'de doğrulama dört ayrı yerde elle yazılmış (`FormReader`, `parseReservationRequest`, `HoldsService.validate`, catalog). Global `ValidationPipe` gövdeler `unknown` olduğu için hiçbir şey yapmıyor ve kurallar `@ApiBody`'de bir kez daha elle tekrarlanıyor. Web'de server action'ların çoğu girdiyi doğrulamadan kullanıyor (QUALITY G-09, G-10).
- **Karar:**
  - **API:** her uç gövde, sorgu ve yol parametresini bir zod şemasıyla bir `ZodValidationPipe` üzerinden alır. Şema hatası ADR-17 biçiminde `422 VALIDATION_FAILED` + `fieldErrors` döner (alan kodları bugünkülerle aynı: `REQUIRED`, `INVALID_FORMAT`...). Şemalar `src/<alan>/<alan>.schemas.ts` dosyalarında durur. `class-validator`, `class-transformer` ve işe yaramayan global `ValidationPipe` kaldırılır. OpenAPI gövde tanımı mümkünse şemadan üretilir; değilse sözleşme testi şemayla `openapi.yaml`'ın uyumunu denetler.
  - **Web:** her server action ilk satırda `safeParse` yapar ve formun kullandığı şemayı yeniden kullanır (`lib/*-schemas.ts`). Doğrulanmamış girdiyle string metodu çağrılmaz. Geçersiz girdi 500 değil alan hatası döner.
  - Ortak şema paketi (`packages/`) **açılmaz**: iki taraf HTTP sözleşmesiyle bağlıdır, kural birliği sözleşme testleriyle sağlanır.
- **Sonuçları:** API'de büyük ama mekanik bir değişikliktir (V2-07). Davranış değişmez; HTTP testleri bunu kanıtlar.

### ADR-27 · Hız sınırı v2: kalıcı depo, tüm uçlar

- **Bağlam:** sınırlayıcı bellekte tutuluyor ve yalnızca 8 uçta var. Render yeniden başlayınca sayaçlar sıfırlanıyor. `POST /reservations` ve okuma uçları sınırsız (G-02, G-11).
- **Karar:**
  - Sayaçlar Postgres'te tutulur: `RateLimitHit` tablosunda `key`, `windowStart`, `count`; atomik `INSERT … ON CONFLICT … DO UPDATE` ile sayılır, eskileri günlük görevle silinir. Redis gibi yeni bir servis eklenmez. Ölçek büyürse ADR yeniden açılır.
  - **Varsayılan sınır her uçtadır** (global guard). Uç bazında daha sıkı sınır dekoratörle verilir. Tablo [SECURITY.md](SECURITY.md)'de tutulur ve her yeni uçta güncellenir.
  - **Anahtar:** girişli istekte `user:<id>`, girişsiz istekte `ip:<adres>`; yönetici istekleri `admin:<id>` (dakikada 120).
  - Sınır aşılınca `429 RATE_LIMITED` ve `Retry-After` başlığı döner.
- **Sonuçları:** her istekte bir veritabanı yazması olur; Neon Free'de bu kabul edilebilir. Okuma uçlarındaki sınır, web sunucusunun ziyaretçi adresini doğru iletmesine (`X-Novera-Client-IP`) dayanır.

### ADR-28 · Dosya yükleme: araç modeli fotoğrafı

- **Bağlam:** G, yöneticinin yeni araç modelini fotoğrafıyla panelden eklemesini istedi. Bugün fotoğraflar repoda (`apps/web/public`) duruyor.
- **Karar:**
  - Fotoğraf bir nesne deposuna yüklenir. Öneri **Vercel Blob**; seçim SPEC §7'de açık karar, ücretsiz katman koşulları uygulama günü doğrulanır.
  - **Yükleme web sunucusundan yapılır:** panel formu dosyayı bir server action'a gönderir. Action yönetici oturumunu API'ye sordurarak doğrular, dosyayı denetler ve depoya yazar; API'ye yalnızca dönen adres (`imageUrl`) gider. Depo anahtarı (`BLOB_READ_WRITE_TOKEN`) yalnızca web sunucusundadır.
  - **Denetim:** yalnızca JPEG, PNG, WebP kabul edilir; tür uzantıya değil dosyanın ilk baytlarına bakılarak anlaşılır. En çok 5 MB, en az 1200 px genişlik. EXIF verisi silinir; dosya adı sunucuda rastgele üretilir.
  - API, `imageUrl` alanında yalnızca izinli depo alan adını ya da `/images/` ile başlayan site içi yolu kabul eder. `next.config.ts` `images.remotePatterns` ve CSP `img-src` aynı alan adıyla güncellenir.
  - Mevcut 15 modelin fotoğrafı repoda kalır; seed onları site içi yolla tutar.
  - Model kaldırılınca fotoğraf silinmez (geçmiş rezervasyon kartları kullanır).
- **Sonuçları:** yeni bir dış servis ve bir gizli anahtar eklenir ([DEPLOY.md](DEPLOY.md)).

### ADR-29 · Örnek veri modu tek yerde

- **Bağlam:** `USE_MOCKS` 23 dosyada yaklaşık 45 kez, dört ayrı `mocksEnabled()` ile okunuyor. Öncelik sırası tutarsız: bir kısım akış `API_URL`'e, bir kısmı `USE_MOCKS`'a önce bakıyor. Kök `.env.example`'da değer `1` ve bu açıkken ödeme öncesi giriş zorunluluğu atlanıyor (G-06, M-06).
- **Karar:**
  - Tek modül: `apps/web/lib/mode.ts` → `dataMode(): 'api' | 'mock'`. Kural: `USE_MOCKS=1` ise mock, değilse api. `API_URL` yoksa ve mock da kapalıysa ekranda "servis kullanılamıyor" görünür.
  - Production'da mock açılamaz: `VERCEL_ENV=production` ya da `NODE_ENV=production` iken `USE_MOCKS` doluysa `next build` ve sunucu açılışı hata verir. CI'daki e2e build'i `NODE_ENV=test` benzeri ayrı bir bayrakla çalışır.
  - `.env.example`'da `USE_MOCKS=` boştur. Giriş koruması mock modunda da açıktır (mock'ta sahte giriş yapılır, koruma atlanmaz).
- **Sonuçları:** mock verisi sunucu paketine yalnızca mock modunda dinamik `import()` ile girer. **Uygulama (V2-06):** test bayrağı `NOVERA_E2E=1` (CI ve Playwright ayarlarında); Vercel production'da bu bayrak da mock'u açmaz. Giriş koruması mock'ta da açık olduğu için ödemeye giren e2e testleri örnek oturum çerezini taşır (`apps/web/e2e/mock-session.ts`); girişsiz ödemenin giriş sayfasına yönlendiği ayrı bir testle denir.

### ADR-30 · Simülasyon verisi

- **Bağlam:** canlı takip ve şarj istasyonu durumu (SPEC §3.E) gerçek cihaz ve servis olmadan gösterilecek.
- **Karar:**
  - Konum, hız, kontak ve istasyon müsaitliği **sunucuda deterministik** üretilir: girdi araç kimliği (ya da istasyon kimliği) ve 5 dakikalık zaman dilimi, çıktı tohumlu sözde rastgele değer. Böylece aynı an için her istek aynı sonucu verir, test edilebilir ve veritabanında büyüyen bir telemetri tablosu oluşmaz.
  - Rotalar her şehir için seed'de tanımlı birkaç çoklu çizgidir (`TrackingRoute`). Araç, zimmet bayisinin şehrindeki bir rota boyunca ilerler; mesai dışında kontak kapalıdır. Şarj istasyonları seed'de kurgusal kayıtlardır (`ChargingStation`: ad, şehir, konum, soket türleri).
  - Tüm simülasyon kodu tek modüldedir (`src/fleet/simulation/`). Cevaplarda `simulated: true` alanı bulunur; ekran bu alana göre "Simülasyon" rozetini gösterir.
- **Sonuçları:** gerçek telematiğe geçilirse yalnızca bu modülün yerine bir veri kaynağı konur; uçların biçimi aynı kalır.

### ADR-31 · Talepler: tek model, türe göre ayrıntı

- **Bağlam:** yol yardım, ikame araç, bakım/lastik ve VIP transfer talepleri (SPEC §3.D) aynı yaşam döngüsüne sahip, ama alanları farklı.
- **Karar:**
  - Tek tablo: `ServiceRequest` (`id`, `number` (`TLP-2026-00001`), `companyId`, `createdById`, `type`, `status`, `fleetVehicleId?`, `details Json`, `assignee` (yöneticinin girdiği serbest metin), `createdAt`, `updatedAt`). Durum değişiklikleri ayrı tabloya yazılır: `ServiceRequestEvent` (`requestId`, `status`, `note`, `actorId`, `at`).
  - `details` her tür için ayrı bir zod şemasıyla doğrulanır (ADR-26). Geçerli durum geçişleri tür başına bir tabloda tanımlıdır; geçersiz geçiş `409 INVALID_TRANSITION` döner.
  - `TRANSFER` türü yalnızca etkin `vip-mobilite` sözleşmesi olan şirkette açılabilir; değilse `403 FORBIDDEN`.
- **Sonuçları:** yeni talep türü eklemek kod tarafında bir şema ve bir geçiş tablosu demektir; migration gerekmez.

### ADR-32 · İçerik çeviri dosyalarında kalır

- **Bağlam:** ürün ve hizmet metinleri hem `messages/*/products.json`, `services.json` dosyalarında hem de API'deki `Product` ve `Service` tablolarında duruyor. Web API'yi hiç çağırmıyor; iki kopya birbirinden kayabilir. G içerik modülünü istemedi (22 Ekim).
- **Karar:**
  - Metinlerin tek kaynağı çeviri dosyalarıdır. `GET /products`, `/products/:slug` ve `/services` uçları, `Service` tablosu ve `Product`'ın metin alanları kaldırılır.
  - `Product` yalnızca `slug` ile kalır. Sebebi: `QuoteRequest.productId` ve `FleetContract.product` bu referansa bağlanır.
  - v1'deki "ürün içeriği API'den gelir" kararı (ADR-17 ek maddesi, BACKLOG Y5) iptal edilir.
- **Sonuçları:** metin değişikliği PR ile yapılır; bu, v1'deki çalışma biçimiyle aynıdır.

---

## 4. Klasör yapısı (v2 eklemeleriyle)

```
apps/web/
  app/[locale]/
    yonetim/            # Yönetim paneli (ADR-24): layout.tsx (rol kontrolü), page.tsx (Özet), <modül>/...
    filom/              # Filom (ADR-25): layout.tsx (şirket kontrolü), page.tsx (Özet), <ekran>/...
  components/
    admin/              # Ortak panel bileşenleri: DataTable, Pagination, FilterChips, BilingualField,
                        # ConfirmDialog, Toast, StaleWriteBanner, UnsavedChangesGuard
    fleet/              # Filom'a özgü bileşenler (harita, grafik, zaman çizelgesi)
  lib/
    mode.ts             # ADR-29
    admin-*.ts, fleet-*.ts  # API istemcileri ve action'lar
  messages/tr|en/admin.json, fleet-panel.json
apps/api/src/
  common/               # RateLimit (ADR-27), ZodValidationPipe (ADR-26), client key, hata yardımcıları, zaman sabitleri
  admin/                # AdminGuard, audit log, /admin/* controller'ları (alan başına alt klasör)
  companies/            # Company, davet
  fleet/                # CompanyGuard, /fleet/*, simulation/ (ADR-30), reports
  requests/             # ServiceRequest (ADR-31)
  media/                # (gerekirse) imageUrl doğrulaması
```

## 5. Sonraya: mobil uygulama

G'nin kararıyla v2'de mobil uygulama yok (SPEC §4). İleride yapılırsa (öneri: Expo / React Native; dağıtım için mağaza gerekmez, Expo Go ve Android APK bağlantısı yeterli) API'de şunlar gerekir. 22 Ekim keşfinde bulundu:

1. **Gizli anahtar:** her uç `X-Novera-Key` istiyor. Uygulamaya gömülen anahtar çıkarılabilir; mobil için ya ayrı bir BFF (web'de `/api/mobile/*`) ya da anahtarsız ama token'lı ayrı bir yol gerekir.
2. **Kimlik:** oturum yalnızca çerezden okunuyor (`session.guard.ts`). Mobil için `Authorization: Bearer` desteği ve yenileme (refresh) token'ı gerekir.
3. **Google ile giriş:** API yalnızca web client ID'sini kabul ediyor. iOS/Android client ID'leri de `aud` olarak eklenmeli.
4. **IP bazlı sınırlar ve tutmalar:** mobil operatörler çok kullanıcıyı tek IP'den çıkarır (CGNAT); ağ değişince tutma bırakılamaz. Anahtar cihaz ya da kullanıcı olmalı (ADR-27 kullanıcı anahtarını zaten getirir).
5. **Sürümleme:** eski uygulama sürümleri kurulu kalacağı için `/v1` öneki gerekir.
6. **Bağlantılar:** şifre sıfırlama ve davet bağlantıları web adresine gidiyor; derin bağlantı (universal/app link) gerekir.

Ucuz ara adım: site zaten bir web manifest'e sahip; 192/512 px PNG ve maskable ikon eklenirse (V2-16) telefonda "ana ekrana ekle" ile uygulama gibi açılır.
