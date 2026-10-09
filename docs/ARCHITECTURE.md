# Novera Mobility: Mimari Kararlar (ARCHITECTURE)

> Durum: **Taslak v0.2** · 9 Ekim 2026 (v0.1: 4 Ekim 2026). v0.2: SPEC v0.3 için ADR-18 ile ADR-23 ve "Backend ile netleşecekler" eklendi.
> Ekip belirli bir teknoloji tercihi belirtmedi; seçimler SPEC'teki ihtiyaçlara göre yapıldı.
> Her karar *Bağlam / Alternatifler / Sonuç / Ödünleşim* düzeninde. Bir karar değişirse burada güncellenir, eski hali "Değiştirildi" notuyla kalır.
> Sürüm numaraları bilerek yazılmadı: kurulum günü her paketin **güncel kararlı** sürümü kullanılır ve `package.json`'a sabitlenir.

---

## Genel bakış

```
                ┌──────────────────────────┐
  Tarayıcı ───▶ │  apps/web  (Next.js)     │  Sayfalar, arayüz, çok dillilik
                └────────────┬─────────────┘
                             │ HTTPS + JSON (OpenAPI sözleşmesi)
                             │ tarayıcı /api/* çağırır, Next iletir (ADR-14)
                ┌────────────▼─────────────┐
                │  apps/api  (NestJS)      │  İş kuralları, kimlik doğrulama
                └────────────┬─────────────┘
                             │ Prisma
                ┌────────────▼─────────────┐
                │  PostgreSQL              │  Kalıcı veri
                └──────────────────────────┘
  Google Maps JS API: tarayıcıdan doğrudan (sadece İletişim sayfası)
```

Tek dil: **TypeScript**, frontend'de de backend'de de.

---

## ADR-01 · Tek repo (monorepo), pnpm workspaces

- **Bağlam:** İki kişi, tek ürün. API sözleşmesi iki tarafı da ilgilendiriyor; bir özelliğin frontend ve backend değişikliği aynı PR'da görülebilmeli.
- **Alternatifler:** İki ayrı repo (frontend / backend). Turborepo veya Nx gibi ek araçlar.
- **Sonuç:** Tek repo, `pnpm` workspaces. Yapı: `apps/web`, `apps/api`, `packages/` (ileride paylaşılan tipler için).
- **Ödünleşim:** Herkes tüm kodu görür (öğrenme hedefi için artı). Ek build aracı yok; ihtiyaç doğarsa Turborepo sonradan eklenebilir.

## ADR-02 · Frontend: Next.js (App Router) + TypeScript

- **Bağlam:** Ürün, hizmet ve hakkımızda sayfaları arama motorlarında bulunmalı (SEO). Kiralama akışı etkileşimli. İki dil (TR/EN) URL seviyesinde. G hazır component'ler getirecek; bunların çoğu React tabanlı.
- **Alternatifler:**
  - *Vite + React (SPA):* Basit, ama sayfalar tarayıcıda oluştuğu için SEO zayıf.
  - *Astro:* İçerik sayfalarında çok hızlı, ama kiralama akışı gibi uygulama tarafı ağırlaşınca React kadar doğal değil; hazır component ekosistemi daha dar.
- **Sonuç:** Next.js App Router. İçerik sayfaları statik üretilir, kiralama akışı sunucu ve istemci component'lerinin karışımı.
- **Değiştirildi (ADR-13):** Tema tercihi çerezden okunduğu için sayfalar artık istek anında sunucuda üretilir, derleme zamanında değil. Sayfalar yine sunucuda üretilmiş HTML olarak döndüğü için SEO etkilenmez.
- **Ödünleşim:** Öğrenme eğrisi SPA'dan dik (sunucu/istemci component ayrımı). Karşılığında SEO, görsel optimizasyonu ve yönlendirme hazır gelir. Belge: [nextjs.org/docs](https://nextjs.org/docs)

## ADR-03 · Stil: Tailwind CSS + tasarım token'ları

- **Bağlam:** SPEC §5'te renk, font, boşluk, köşe yarıçapı tanımlı. Bu değerlerin tek bir yerde durması ve hiçbir component'te ham hex yazılmaması gerekiyor. Hazır component'lerin (ör. shadcn/ui) büyük kısmı Tailwind ile yazılıyor.
- **Alternatifler:** CSS Modules + CSS değişkenleri (sade, ama hazır component'leri uyarlarken her birini baştan yazmak gerekir). styled-components (çalışma zamanı maliyeti, Next.js sunucu component'leriyle uyumu zahmetli).
- **Sonuç:** Tailwind CSS. Token'lar CSS değişkeni olarak tek dosyada tanımlanır ve Tailwind temasına bağlanır. Kural: **component içinde ham renk/boşluk değeri yok**, sadece token sınıfları.
- **Ödünleşim:** HTML'de uzun sınıf listeleri. Karşılığında hazır component'ler neredeyse doğrudan uyarlanır. Belge: [tailwindcss.com/docs](https://tailwindcss.com/docs)

## ADR-04 · Çok dillilik: next-intl

- **Bağlam:** Türkçe ana dil, İngilizce v1'de var. URL yapısı `/` (TR), `/en/...` (EN).
- **Alternatifler:** Next.js'in yerleşik yönlendirmesiyle elle çözüm; i18next.
- **Sonuç:** next-intl. Metinler özellik başına ayrı dosyalarda: `messages/tr/<özellik>.json` ve `messages/en/<özellik>.json`; her dosya `i18n/messages.ts` içinde bir satırla kaydedilir. Tek dosya yerine bölünmesinin sebebi: her yeni özellik aynı yere anahtar eklediği için iki branch her merge'de çakışıyordu. İngilizce dosyaların Türkçe ile aynı anahtarlara sahip olması derleme zamanında zorunludur. Sayfaya gömülü metin yazılmaz.
- **Yollar:** `i18n/routing.ts` içindeki `pathnames` tablosu Türkçe yolları (SPEC §2.1) anahtar olarak tutar; `/en` altında İngilizce karşılıkları gösterilir (`/araclar` ↔ `/en/cars`). Klasör adları (`app/[locale]/araclar`) Türkçe kalır. Yeni bir sayfa eklenince yolu bu tabloya da eklenmelidir; `Link` ve `usePathname` bu tabloya göre tiplenir.
- **Ödünleşim:** Her metin bir anahtar üzerinden yazılır, ilk başta yavaş hissettirir; ikinci dil eklemek sonradan dosya doldurmaktan ibaret olur. Belge: [next-intl.dev](https://next-intl.dev/)

## ADR-05 · Backend: NestJS + TypeScript

- **Bağlam:** Ekip "şirkette çalışır gibi" öğrenmek istiyor. Backend REST API sunacak, kimlik doğrulama, rezervasyon, teklif ve bayi verisini yönetecek. API sözleşmesi otomatik belgelenmeli.
- **Alternatifler:**
  - *Express / Fastify:* Hafif ve basit, ama yapı tamamen ekibe kalır; iki kişilik öğrenme projesinde dağınıklığa açık.
  - *Spring Boot (Java) / ASP.NET (C#):* Kurumsal dünyada çok yaygın, ama frontend'le dil paylaşılmaz; tipler iki kez yazılır.
- **Sonuç:** NestJS. Modül yapısı (her alan kendi klasöründe: `branches`, `vehicles`, `reservations`, `auth`...) şirketlerdeki katmanlı mimariyi öğretir. `@nestjs/swagger` ile OpenAPI belgesi koddan üretilir.
- **Ödünleşim:** Express'e göre daha çok kalıp kod (decorator, module, provider). Karşılığında düzen hazır gelir. Belge: [docs.nestjs.com](https://docs.nestjs.com/)

## ADR-06 · Veritabanı: PostgreSQL + Prisma

- **Bağlam:** Veri ilişkisel: kullanıcı → rezervasyon → araç → bayi. Tarih aralığı sorguları (araç müsait mi?) var.
- **Alternatifler:** MongoDB (ilişkisel veri için doğal değil). MySQL (geçerli, ama PostgreSQL'in tarih aralığı ve coğrafi uzantı desteği daha güçlü). TypeORM / Drizzle (Prisma'nın şema dosyası ve migration akışı yeni başlayan için daha okunaklı).
- **Sonuç:** PostgreSQL, ORM olarak Prisma. Geliştirmede veritabanı Docker Compose ile yerelde çalışır; ikiniz de aynı sürümü kullanırsınız.
- **Ödünleşim:** Docker kurulumu gerekir. Prisma'da çok karmaşık sorgular için ham SQL'e inmek gerekebilir. Belge: [prisma.io/docs](https://www.prisma.io/docs)
- **Not:** npm'de Prisma'nın "latest" etiketi şu an bir sürüm adayını (rc) gösteriyor; kurulumda kararlı sürüm seçilmeli.

## ADR-07 · API sözleşmesi önce (contract-first) ve mock

- **Bağlam:** Frontend ve backend asenkron, birbirini beklemeden ilerlemeli.
- **Alternatifler:** Backend bittikçe frontend bağlanır (frontend sürekli bekler). GraphQL (iki kişilik REST ihtiyacı için fazla).
- **Sonuç:**
  1. Her uç nokta önce `docs/api/openapi.yaml` dosyasına yazılır ve PR ile ikiniz onaylarsınız.
  2. Frontend bu dosyadan `openapi-typescript` ile TypeScript tiplerini üretir.
  3. Backend henüz hazır değilken frontend **MSW** (Mock Service Worker) ile sahte cevaplarla çalışır.
  4. Backend hazır olunca mock kapatılır, gerçek API'ye bağlanılır.
- **Ödünleşim:** Başta sözleşme yazmak yavaş gelir; sonradan "backend şunu döndürmüyormuş" sürprizlerini önler. Belgeler: [openapi-ts.dev](https://openapi-ts.dev/), [mswjs.io](https://mswjs.io/)

## ADR-08 · Kimlik doğrulama: e-posta + şifre, httpOnly çerez

- **Bağlam:** Giriş ödemeden hemen önce istenir. Profil sayfası var. Gerçek ödeme yok.
- **Alternatifler:** Auth.js / Clerk gibi hazır servisler (hızlı, ama backend'ci arkadaşın öğrenme hedefini elinden alır). Token'ı `localStorage`'da tutmak (XSS'e açık).
- **Sonuç:** Backend'de e-posta + şifre (şifre `argon2` ile hash'lenir), oturum `httpOnly`, `Secure`, `SameSite` çerezinde.
- **Ödünleşim:** Şifre sıfırlama, oturum yenileme gibi işler elle yazılır. Öğrenme projesi için bilinçli seçim.

## ADR-09 · Harita: Google Maps JavaScript API

- **Bağlam:** G'nin kararı; arkadaşı daha önce Google Cloud API bağlamış.
- **Sonuç:** Bayi verisi (koordinat dahil) backend'den gelir; harita frontend'de `@vis.gl/react-google-maps` ile çizilir. Harita kodu sadece İletişim sayfasında yüklenir.
- **Ödünleşim / dikkat:** Tarayıcıda kullanılan API anahtarı herkes tarafından görülebilir. Google Cloud'da **HTTP referrer kısıtlaması** ve kota sınırı mutlaka konmalı; anahtar repoya yazılmaz, ortam değişkeninde durur. Belge: [developers.google.com/maps/api-security-best-practices](https://developers.google.com/maps/api-security-best-practices)

## ADR-10 · Formlar ve doğrulama: React Hook Form + Zod

- **Bağlam:** Arama, teklif, kayıt, giriş, sahte ödeme formları.
- **Sonuç:** Frontend'de React Hook Form + Zod şemaları. Backend NestJS'in kendi doğrulamasını (class-validator) kullanır; kurallar aynı tutulur.
- **Ödünleşim:** Kurallar iki yerde. İleride `packages/` altında ortak Zod şemasına taşınabilir.

## ADR-11 · Kalite: ESLint, Prettier, Vitest, Playwright, GitHub Actions

- **Sonuç:**
  - Her PR'da GitHub Actions: lint, tip kontrolü, birim testleri, build. Biri kırmızıysa merge yok.
  - Birim testleri: Vitest (web), Jest (api, NestJS varsayılanı).
  - Uçtan uca test: Playwright, SPEC §8'deki akışlar.
  - Commit mesajları: Conventional Commits (`feat:`, `fix:`, `docs:`...).
- **Ödünleşim:** Kurulum günü biraz zaman alır; sonrasında "bende çalışıyordu" tartışmasını bitirir.

## ADR-12 · Yayın

- **Sonuç (öneri, en son karar verilecek):** Web → Vercel. API + PostgreSQL → Render, Railway veya Fly.io gibi bir servis.
- **Dikkat:** Bu servislerin ücretsiz plan koşulları sık değişiyor; **doğrulanmadı**. Yayın fazına gelince güncel koşullara bakılacak.

## ADR-13 · Tema tercihi: çerez + `data-theme`

- **Bağlam:** SPEC §2.4: açık/koyu tema, tercih hatırlanır, giriş yapan kullanıcıda hesaba kaydedilir. Yanlış temada bir an görünmek (flash) kabul edilemez.
- **Alternatifler:** `localStorage` + `<head>`'de küçük bir satır içi script (sayfalar statik kalır, ama sunucu temayı bilmez; ileride CSP sıkılaşırsa nonce gerekir). `next-themes` gibi bir paket (bu iş için gereksiz bağımlılık).
- **Sonuç:** Tercih `novera-theme` çerezinde (`light` | `dark`; çerez yoksa "sistem"). Sunucu çerezi okuyup `<html data-theme>` ve `color-scheme` meta'sını ilk HTML'e yazar. CSS tarafında `data-theme`, `color-scheme`'i zorlar; tüm semantik token'lar `light-dark()` ile bu değere bağlıdır. Tailwind'in `dark:` varyantı da etkin temayı (zorlanan ya da sistem) izler. Çerezi anahtar istemciden yazar; çerez dışında bir kimlik bilgisi içermez.
- **Ödünleşim:** Kök layout `cookies()` okuduğu için **tüm rotalar istek anında üretilir**, derleme zamanında statik üretilmez (ADR-02'ye not düşüldü). Karşılığında flash yok ve giriş yapan kullanıcının tercihini hesaba taşımak (BACKLOG #28) sunucuda çerezi okumaktan ibaret. Çerez işlevsel bir tercih çerezidir; `/cerez-politikasi` metninde (BACKLOG #36) belirtilmeli.

---

## ADR-14 · API'ye erişim: Next üzerinden proxy

- **Bağlam:** Giriş çerez tabanlı (ADR-08), web ve API ayrı servisler (ADR-12). Tarayıcı API'ye doğrudan giderse çerezin çalışması farklı alan adlarına bağlı kalır.
- **Alternatifler:** Tarayıcı API adresini doğrudan çağırır: backend CORS'ta tam origin ve `credentials` izni vermeli, canlıda alan adları farklıysa çerez `SameSite=None; Secure` olmalı ve üçüncü taraf çerez engelleyen tarayıcılarda bozulabilir.
- **Sonuç:** Tarayıcı `/api/...` çağırır, Next `rewrites` ile `API_URL`'deki NestJS'e `/api` öneki kaldırılarak iletir. Tarayıcıya göre API aynı siteden gelir: çerez birinci taraf olur, **CORS ve `SameSite=None` gerekmez**. Kurallar:
  - Frontend istekleri `credentials: "include"` ile atar.
  - Backend çerezi `httpOnly`, `Secure` (canlıda), `SameSite=Lax` koyar; route'lar `/api` öneki olmadan çalışır.
  - Durum değiştiren uçlar yalnızca `POST/PUT/PATCH/DELETE` olur (CSRF: `SameSite=Lax` yalnızca güvenli yöntemlerin çapraz site isteğine çerez eklemesine izin verir).
  - Sunucu bileşenleri API'yi çağırırken gelen isteğin çerezini kendisi iletir (tarayıcı olmadığı için çerez otomatik gitmez).
  - Swagger belgesi (`/docs`) doğrudan API'de açılır, proxy'den geçmez.
- **Ödünleşim:** Tüm API trafiği bir atlama daha yapar ve Next sunucusundan geçer; canlıdaki süre ve boyut sınırları **doğrulanmadı** (yayın fazında bakılacak). Dosya yükleme gibi büyük gövdeler v1 kapsamında yok.

## ADR-15 · Para birimi: TRY, EUR, USD (backend kuru tutar)

- **Bağlam:** Ziyaretçi fiyatları TL, euro veya dolar olarak görmek istiyor. SPEC'te daha önce para birimi seçimi yoktu; kapsam genişledi.
- **Alternatifler:** Kur frontend'de sabit bir tabloda (backend'e dokunmaz ama rezervasyon tutarı ile ekrandaki tutar tutarsız olabilir). Frontend'in doğrudan dış kur servisi çağırması (anahtar ve hata durumları tarayıcıda, rezervasyonla bağı yok).
- **Sonuç:** **Kur backend'de** `ExchangeRate` tablosunda durur; günde bir kez zamanlanmış görev bir dış kur servisinden günceller (kuru günde bir değişse yeter). Fiyatlar TRY'de tutulur, çevrilen tutarlar API'den gelir:
  - Her tutar para birimiyle birlikte gelir: `{ "amount": 125000, "currency": "TRY" }`; `amount` alt birimin (kuruş/cent, üçünde de 100'e bölünür) tam sayısıdır.
  - Fiyat uçları `?currency=EUR` alır (varsayılan TRY), dönüştürüp en yakın alt birime yuvarlayarak verir.
  - Rezervasyon seçilen para birimini **ve o anki kuru** kaydeder; sonradan kur değişse de rezervasyon sabit kalır (şemadaki "rezervasyon anındaki fiyatlar" ilkesi). Ödeme sahte olduğu için para alınmaz, ekranda yazar.
  - `GET /rates` (`updatedAt` ile) kuru gösterir. Dış servis çökerse son bilinen kur kullanılır; hiç kur yoksa seed kur.
  - Frontend **kur çevirmez**: seçimi `novera-currency` çerezinde tutar (tema gibi), isteklerde `?currency=` olarak iletir, `formatMoney` ile gösterir. Seçim girişli kullanıcıda hesaba kaydedilir (BACKLOG #28).
- **Ödünleşim:** Hangi dış servisin kullanılacağı ve ücretsiz kullanım koşulları **doğrulanmadı**; seçerken bakılacak. Çevrilen tutarlarda yuvarlama toplamı bozabilir: toplam sunucuda hesaplanır, ekranda hiçbir tutar yuvarlanmaz (tam tutar ondalıksız, kuruşlu/centli tutar iki ondalıkla gösterilir).

## ADR-16 · Tarih ve saat dilimi

- **Bağlam:** Kiralamalar Türkiye'de; Türkiye tek saat diliminde (UTC+3) ve yaz saati uygulamıyor. next-intl varsayılanı sunucunun kendi saat dilimini kullanıyor, bu da aynı rezervasyonun geliştirmede ve canlıda farklı yazılmasına yol açıyordu.
- **Sonuç:** API her anı **ISO 8601, UTC** gönderir (`2026-10-12T10:00:00Z`). Frontend göstermek ve girmek için **`Europe/Istanbul`** kullanır (`i18n/request.ts` içinde sabit). Müsaitlik UTC anları üzerinden hesaplanır. Saat seçimi 30 dakikalık dilimlerdir.
- **Ödünleşim:** Yurt dışı bayi eklenirse `Branch.timeZone` alanı gerekir; v1'de tüm bayiler Türkiye'de.

## ADR-17 · API sözleşme kuralları

- **Hata biçimi:** `{ "code": "VALIDATION_FAILED", "message": "geliştirici için İngilizce metin", "fieldErrors": { "email": "EMAIL_TAKEN" } }`. `code` ve `fieldErrors` değerleri **sabit makine kodlarıdır** (`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `VEHICLE_UNAVAILABLE`...); frontend metni kendi çeviri dosyasından gösterir, `message` ekranda gösterilmez. HTTP kodları: 400/422 doğrulama, 401 oturum yok, 404, 409 çakışma.
- **Dil:** Çevrilen alanlar **iki dille birlikte** döner (`"name": { "tr": "Ekonomik", "en": "Economy" }`). Cevap dile göre değişmez; dil değişince yeniden istek gerekmez, önbellekleme ve mock basit kalır.
- **Sayfalama:** Yok, düz liste (15 model, 15 bayi; SPEC §4.1). Sunucu yalnızca müsaitliği (tarih + lokasyon) filtreler; sınıf, yakıt, vites gibi filtreleri frontend yapar. İletişim sayfasındaki bayi filtresi (şehir) ve araması da tarayıcıda yapılır.
- **Ürün ve hizmet içeriği API'den gelir** (SPEC §7): `Product`, `Service` modelleri ve `GET /products`, `GET /products/:slug`, `GET /services` uçları, iki dilli alanlarla. Teklif isteği ürün slug'ını (`akilli-kurumsal-filo`) isteğe bağlı taşır. Sayfalar API gelene kadar çeviri dosyalarındaki metinle (SPEC Ek A) çalışır, sonra API'ye bağlanır (BACKLOG Y5).

## ADR-18 · SEO: meta verisi, robots, sitemap, yapılandırılmış veri

- **Bağlam:** SPEC §9 "çok iyi SEO" istiyor. Site iki dilli; iki dilin aynı içerik sanılmaması gerekiyor. Giriş, profil ve ödeme gibi sayfalar arama sonuçlarında görünmemeli.
- **Alternatifler:** `next-sitemap` gibi bir paket (build sonrası script; Next'in Metadata API'si aynı işi bağımlılıksız yapıyor). Özel sayfaları robots.txt ile engellemek (Google engellenen sayfayı taramadığı için `noindex`'ini de göremez; sayfa başka yerden link alırsa adresi yine dizine girebilir).
- **Sonuç:**
  - Her sayfa `generateMetadata` ile başlığını ve açıklamasını kendi çeviri dosyasından verir. Canonical ve dil eşlemesi (`alternates.canonical`, `alternates.languages`, `x-default` = TR) tek bir yardımcıdan (`lib/seo.ts`) üretilir; yollar `i18n/routing.ts`'teki `pathnames` tablosundan alınır, ayrı liste tutulmaz. Sorgu parametreleri (`?tip=`, `?arac=`, arama parametreleri) canonical'a girmez.
  - Mutlak adresler `NEXT_PUBLIC_SITE_URL`'den gelir (`lib/site-url.ts`); boşsa yerel adres.
  - `app/robots.ts` yalnızca `/api/`'yi engeller ve site haritasını gösterir. Özel sayfalar `robots: { index: false }` ile çıkarılır (liste SPEC §9).
  - `app/sitemap.ts` herkese açık sayfaların tek listesidir, iki dilde ve dil eşlemesiyle. Araç detay sayfası kalktığı için (SPEC v0.3) sitemap API'ye bağlı değildir. `llms.txt` aynı listeden bir route handler ile üretilir, iki liste ayrışmaz.
  - Paylaşım görseli `opengraph-image.tsx` ile kodda üretilir. `app/manifest.ts` ve `theme-color` (viewport) favicon işinin parçasıdır.
  - JSON-LD sunucuda `<script type="application/ld+json">` olarak yazılır: kök layout'ta `Organization`, İletişim'de her bayi için `AutoRental`. `FAQPage` eklenmez: G'nin öneri dosyasına göre Google bu zengin sonucu 2023'ten beri yalnızca resmi kurum ve sağlık sitelerinde gösteriyor.
- **Ödünleşim:** Canonical, sitemap ve JSON-LD'deki adresler yayın alan adına bağlı; alan adı belli olana kadar yerel adres yazılır. `feat/seo-assets` dalındaki robots.txt özel sayfaları engelliyor; bu karar gereği BACKLOG Y13'te düzeltilir.

## ADR-19 · Çerez onayı ve analytics

- **Bağlam:** SPEC §9 çerez onayı ve analytics istiyor. Bugünkü çerezler işlevsel tercihler (tema, para birimi; ADR-13, ADR-15) ve ileride oturum çerezi (ADR-08). G'nin öneri dosyasına göre KVKK'nın çerez rehberi zorunlu olmayan çerezler için onay bekliyor (rehber metni doğrulanmadı).
- **Alternatifler:** Hazır onay servisi (Cookiebot, CookieYes): hızlı kurulur ama harici script ekler, çoğu ücretli ve tasarım token'larına uymaz. GA4: güçlü ve ücretsiz ama çerez kullanır; onay olmadan yüklenemez, Consent Mode kurulumu gerekir.
- **Sonuç:**
  - Kendi bileşenimiz: alt bant (Kabul et / Reddet / Ayarlar, üçü eşit görsel ağırlıkta) ve ayar penceresi (Zorunlu: her zaman açık; Analitik: aç/kapa). Footer'daki "Çerez tercihleri" pencereyi yeniden açar.
  - Seçim `novera-consent` çerezinde tutulur (`{ v, analytics }`, 6 ay). Sunucu çerezi tema çerezi gibi okur (ADR-13): onay yoksa analytics script'i HTML'e hiç yazılmaz, bant ilk HTML'de gelir, yanıp sönme olmaz. `v` artırılırsa bant yeniden sorulur.
  - Analytics çerez kullanmayan bir araçtır: web Vercel'e giderse Vercel Web Analytics, gitmezse Umami (SPEC §10; ücretsiz plan koşulları doğrulanmadı). Çerezsiz olsa da yalnızca onayla yüklenir: tek kural, sade hukuki duruş.
  - Analytics ayarı ortam değişkeniyle verilir; boşsa (geliştirme, önizleme) hiç yüklenmez.
- **Ödünleşim:** Reddeden ziyaretçi ölçülmez. Metin ve davranış hukuki incelemeden geçmedi (kurgusal proje).

## ADR-20 · Form gönderimi

- **Bağlam:** İletişim formu ve kurumsal form kişisel veri topluyor ve "gerçekten çalışmalı" (SPEC §9). Backend uçları henüz yok.
- **Alternatifler:** Formspree / Web3Forms gibi bir servis (bugün çalışır, ama kişisel veri üçüncü tarafa gider ve anahtar gerekir). Next server action ile doğrudan e-posta (SMTP sırrı web uygulamasına girer, backend'in işini web yapar). Cloudflare Turnstile (güçlü bot koruması, ama harici script ve anahtar).
- **Sonuç:**
  - Formlar ADR-10'daki gibi React Hook Form + Zod. Gönderim `lib/<form>-client.ts` üzerinden `/api/contact` ve `/api/quotes`'a gider (ADR-14). Hata cevabı ADR-17 biçimindedir; `fieldErrors` ilgili alanın yanında gösterilir.
  - Backend gelene kadar: `USE_MOCKS=1` iken istemci başarı döner, kapalıyken "servis kullanılamıyor" gösterilir. Üretimde örnek başarı gösterilmez.
  - Spam: görünmeyen bir tuzak alan (ekran okuyucudan ve klavyeden gizli, `autocomplete="off"`). Doluysa istemci göndermeden başarı gösterir; backend de reddeder ve IP başına hız sınırı uygular (BACKLOG #39). Gerekirse Turnstile sonra eklenir.
  - KVKK onay kutusu zorunludur ve aydınlatma metnine bağlanır; backend onay zamanını kaydeder.
  - Ortak parçalar (tuzak alan, onay kutusu, başarı durumu) ilk formda `components/form/` altına yazılır, sonraki formlar yeniden kullanır.
- **Ödünleşim:** Backend uçları gelene kadar formlar canlıda çalışmaz. Site backend'den önce yayına çıkacaksa bu karar yeniden açılır.

## ADR-21 · Hareketli bileşenler: Framer yok, animasyon kütüphanesi yok

- **Bağlam:** SPEC v0.3 Framer bileşenlerini görsel ve davranış referansı olarak veriyor (logo şeridi, sayaç, eğri zaman çizelgesi, iki SSS, footer). Bu bileşenler `framer` ve `framer-motion` paketlerine bağlı ve Framer düzenleyicisi için yazılmış: satır içi stil, ham renk ve font değerleri.
- **Alternatifler:** Framer kodunu olduğu gibi almak (token ve erişilebilirlik kurallarını bozar, Framer'a bağımlılık getirir). `motion` paketi (yay animasyonu hazır gelir, ama dört küçük bileşen için yeni bir bağımlılık).
- **Sonuç:** Bileşenler mevcut yapıyla (Tailwind token'ları, next-intl, erişilebilirlik kuralları) yeniden yazılır; yeni paket eklenmez.
  - Logo şeridi: CSS `@keyframes`; tekrarlanan kopya `aria-hidden`; durdurma düğmesi animasyonu duraklatır.
  - Sayaç: küçük bir istemci bileşeni (`IntersectionObserver` + `requestAnimationFrame`). Son değer sunucu HTML'inde yazılıdır; JavaScript yoksa ve ekran okuyucu için doğru değer okunur, sayma yalnızca görsel katmandadır.
  - SSS: mevcut `<details>` tabanlı Accordion korunur; yaylı açılma CSS ile (yay eğrisi `linear()` ile yaklaşık). Desteklemeyen tarayıcıda anında açılır.
  - Galeri: CSS scroll-snap, oklar ve noktalar.
  - Hikayemiz: SVG eğri ve düğmeler; 768 px altında dikey liste.
  - Hepsi Tailwind'in `motion-safe:` / `motion-reduce:` varyantlarıyla `prefers-reduced-motion`'a uyar.
- **Ödünleşim:** Yay hissi gerçek fizik değil, yaklaşık bir eğri. Yeni CSS özelliklerinin tarayıcı desteği uygulama sırasında yeniden kontrol edilir.

## ADR-22 · Araçlarımız penceresi: `<dialog>` + adres parametresi

- **Bağlam:** SPEC §2.4: karta tıklanınca yeni sayfa değil pencere açılır; pencere paylaşılabilir olmalı.
- **Alternatifler:** Next "intercepting routes": her araca gerçek bir adres verir, ama adres doğrudan açılınca ayrı bir sayfa olarak görünür (G "yeni sayfa açılmasın" dedi) ve iki görünümün bakımı gerekir. Hazır modal kütüphanesi: gereksiz bağımlılık; yerel `<dialog>` odak tuzağını, Esc'yi ve arka planın etkisizleşmesini zaten sağlıyor.
- **Sonuç:** Yerel `<dialog>` ve `showModal()`. Açık model adreste `?arac=<model-slug>` olarak durur; sayfa bu parametreyle sunucuda üretilir, istemci yüklenince pencereyi açar, böylece paylaşılan link aynı pencereyle gelir. Açma ve kapama adresi `history` ile günceller, sunucuya yeni istek gitmez; geri tuşu pencereyi kapatır. Modelin bayileri sayfada zaten yüklü olan araç listesinden türetilir. Canonical `/araclarimiz`.
- **Ödünleşim:** Model pencereleri arama motorunda ayrı sayfa olarak yer almaz. Bilinçli bir tercih: aynı bilgi zaten kartlarda.

## ADR-23 · Hata sayfaları (404, 500)

- **Sonuç:** 404 `app/[locale]/not-found.tsx`'tedir (var). 500 için `app/[locale]/error.tsx`: header ve footer korunur, "Tekrar dene" sayfayı yeniden dener. Kök layout'un kendisi çökerse `app/global-error.tsx` devreye girer; kendi `<html>`'ini yazar ve metni provider olmadan çeviri dosyasından doğrudan okur. Hata sayfaları `noindex`'tir.
- **Ödünleşim:** `global-error` layout'u kullanamadığı için tema ve dil çerezini kendisi okur; görünümü sade tutulur.

## Backend ile netleşecekler (BACKLOG #6, `openapi.yaml`)

Frontend örnek veriyi bu cevaplara göre yazar; backend gelince yalnızca adres değişir. Karar verilmiş olanlar ilgili ADR'de, açık olanlar burada.

| Konu | Durum / öneri |
|---|---|
| Model ve fiziksel araç ayrımı | **Açık.** Öneri: `VehicleModel` (slug, marka, model, sınıf, koltuk, bagaj, vites, yakıt, tüketim + birim, iki dilli açıklama, görsel) ve `Vehicle` (model, bayi, aktif). Araçlarımız modeli, arama sonuçları fiziksel aracı gösterir |
| Yakıt tüketimi | **Açık.** Yeni alan: değer + birim (L/100 km, elektrikli için kWh/100 km) |
| Seed rakamları | SPEC §4.1: 14 şehirde 15 bayi, 15 model, her model 1–4 bayide |
| Müsaitlik parametreleri | Alış ve iade bayisi, alış ve iade anı (30 dakikalık dilim, ISO 8601 UTC; ADR-16) |
| Farklı bayiye bırakma | **Açık.** Serbest mi, ek ücreti var mı? Varsa özette ayrı kalem |
| Fiyat hesabı | Backend hesaplar, frontend yalnızca gösterir (ADR-15). **Açık:** KDV dahil mi? |
| Kirala'da geçici tutma | **Açık.** Araç özet/ödeme süresince tutuluyor mu (ör. 15 dk)? Tutulmuyorsa çakışma ödemede `409 VEHICLE_UNAVAILABLE` |
| Sahte ödeme | **Açık.** Rezervasyonu "ödendi" yapan bir uç mu, yalnızca ekran mı? |
| İletişim formu | `POST /contact`: ad soyad, e-posta, telefon (isteğe bağlı), konu, mesaj, KVKK onay zamanı. **Açık:** gönderilen form yalnızca veritabanına mı, e-postaya da mı düşüyor? |
| Kurumsal form | `POST /quotes`; alanlar kurumsal tasarım onayından sonra (SPEC §10) |
| Spam | Tuzak alan doluysa reddet; IP başına hız sınırı (ADR-20, #39) |
| Hata biçimi, çeviri, tarih | Karar verildi: ADR-17, ADR-16 |
| Görseller | **Açık.** Araç ve kampanya görselleri nerede duracak? `next/image` için alan adı gerekir |
| Kampanyalar, iş ortakları | Şimdilik frontend'de sabit; kampanyaların API'ye taşınması açık (SPEC §10) |
| Harita | Harita frontend'de, bayi koordinatları backend'den, anahtarı backend sahibi yönetir (ADR-09). Teyit edilecek |
| Yayın adresleri | **Açık.** Çerez, canonical ve sitemap buna bağlı (ADR-12, ADR-14, ADR-18) |

## Klasör yapısı

```
novera/
├─ apps/
│  ├─ web/                  # Next.js
│  │  ├─ app/[locale]/      # Sayfalar (tr, en)
│  │  ├─ app/               # robots.ts, sitemap.ts, manifest.ts, llms.txt, global-error.tsx (ADR-18, ADR-23)
│  │  ├─ components/        # ui/ (temel), layout/, özellik klasörleri (home/, vehicle/, contact/, form/...)
│  │  ├─ messages/          # tr/<özellik>.json, en/<özellik>.json
│  │  ├─ i18n/              # next-intl yönlendirme ve istek ayarları
│  │  ├─ app/globals.css    # Tüm tasarım token'ları (Tailwind temasına bağlı)
│  │  └─ mocks/             # Örnek veri (USE_MOCKS=1); MSW gelince sahte cevaplar (BACKLOG #12)
│  └─ api/                  # NestJS
│     ├─ src/<modül>/       # auth, branches, vehicles, reservations, quotes, faq
│     └─ prisma/            # schema.prisma, migrations, seed
├─ docs/
│  ├─ SPEC.md
│  ├─ ARCHITECTURE.md
│  └─ api/openapi.yaml
├─ docker-compose.yml       # Yerel PostgreSQL
├─ CLAUDE.md
└─ .github/
   ├─ workflows/ci.yml
   └─ pull_request_template.md
```

---

## Çalışma düzeni

- **Dal stratejisi:** `main` her zaman çalışır durumda. Her iş için `feat/<kısa-ad>`, `fix/<kısa-ad>` dalı. Doğrudan `main`'e push yok.
- **PR kuralı:** Her PR bir issue'ya bağlı ("Closes #12"), diğer kişi review eder, CI yeşil olmadan merge edilmez.
- **Görev panosu:** GitHub Projects. Sütunlar: Backlog → Bu hafta → Yapılıyor → Review'da → Bitti.
- **Asenkron iletişim:** Haftada bir yazılı durum notu (ne yaptım / ne yapacağım / neye takıldım), proje panosunda veya bir issue'da.
- **Ortam değişkenleri:** `.env` repoya girmez; `.env.example` girer.
