# Novera Mobility: İlk İş Listesi (Backlog)

> 4 Ekim 2026 · SPEC v0.2 ve ARCHITECTURE v0.1'e göre. **9 Ekim 2026:** SPEC v0.3 ve ARCHITECTURE v0.2 için M7 eklendi; değişen satırlarda **v0.3** notu var.
> Her satır GitHub'da bir issue olur. **Sahip:** FE = G (frontend), BE = arkadaş (backend), İKİ = birlikte.
> Kilometre taşları sırayla ilerler; bir taşın içindeki FE ve BE işleri **paralel** yürür.
> "Bağımlı" sütunu: o iş başlamadan bitmesi gereken iş.
> **Issue numarası:** Aşağıdaki `#` sütunu backlog numarasıdır, GitHub issue numarası değil. İlk 40 satırın issue numarası **backlog numarası + 9**'dur (#7 → issue #16, #29 → issue #38). PR gövdesine ve commit mesajına `Closes #<issue numarası>` yazılır, backlog numarası değil (aksi halde yanlış issue ya da bir PR kapanır). Y ile başlayan satırlar sonradan eklendi; issue açılınca numarasını alır.

---

## M0 · Kurulum (birlikte)

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 1 | GitHub reposu, collaborator, `main` koruması, Projects panosu | İKİ | — | İkiniz de push/PR açabiliyor; `main`'e doğrudan push reddediliyor |
| 2 | Monorepo iskeleti: pnpm workspaces, `apps/web`, `apps/api`, `docs/` | İKİ | 1 | `pnpm install` iki makinede de hatasız |
| 3 | SPEC ve ARCHITECTURE'ı `docs/` altına taşı, PR şablonu ekle | FE | 2 | PR açınca şablon görünüyor |
| 4 | CI: lint + tip kontrolü + test + build (GitHub Actions) | BE | 2 | Bilerek bozuk bir PR'da CI kırmızı |
| 5 | `CLAUDE.md`: proje kuralları (ham hex yok, metin çeviri dosyasında, mobile-first vb.) | FE | 2 | 200 satırdan kısa |
| 6 | API sözleşmesi v1: `openapi.yaml` (bayiler, araçlar, ürünler, hizmetler, kurlar, rezervasyon, teklif, auth, SSS). ARCHITECTURE ADR-14 ile ADR-17'deki kurallara uyar: hata biçimi, iki dilli alanlar, `{ amount, currency }` tutarlar, ISO 8601 UTC zamanlar | İKİ | 2 | İkinizin onayıyla merge; ARCHITECTURE "Backend ile netleşecekler" tablosundaki açık konular cevaplanmış |

## M1 · Temel

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 7 | Next.js + Tailwind kurulumu, `globals.css` token'ları (SPEC §5 renk/font/boşluk) | FE | 2 | Token dışı renk kullanan sınıf lint'te uyarı veriyor |
| 8 | next-intl: `/` TR, `/en` EN, dil değiştirici | FE | 7 | Aynı sayfa iki dilde açılıyor |
| 9 | Temel UI bileşenleri: Button, Input, Select, DatePicker, SegmentedControl, Accordion, Card | FE | 7 | Her biri klavyeyle kullanılabiliyor, odak halkası görünür |
| 10 | Header (masaüstü menü + mobil hamburger + profil/giriş) ve Footer (dil, tema, yasal linkler) | FE | 8, 9 | 375 / 768 / 1280'de doğru |
| 11 | Açık/koyu tema | FE | 7 | Tercih hatırlanıyor, kontrastlar AA |
| 12 | MSW kurulumu ve sözleşmeden tip üretimi | FE | 6 | Mock açıkken sahte bayi listesi dönüyor |
| 13 | NestJS kurulumu, Swagger, sağlık kontrolü uç noktası | BE | 2 | `/docs` adresinde API belgesi açılıyor |
| 14 | Docker Compose ile PostgreSQL, Prisma şeması (User, Branch, VehicleClass, Vehicle, Extra, Reservation, QuoteRequest, FaqItem, Product, Service, ExchangeRate) | BE | 13 | `prisma migrate` iki makinede de çalışıyor |
| 15 | Seed verisi: 15 bayi / 14 şehir (gerçekçi koordinat), 15 araç modeli (SPEC §4.1, v0.3), SSS (bireysel + kurumsal), 4 ürün, 5 hizmet, başlangıç kurları | BE | 14 | Tek komutla veritabanı doluyor |

## M2 · Kiralama akışı (bireysel)

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 16 | Ana sayfa: Bireysel/Kurumsal anahtarı, arama alanı, kitleye göre değişen bölümler, Yol Boyu Güvence bandı · **v0.3:** bölüm sırası ve kurumsal akış değişti → Y15–Y18 | FE | 10, 12 | Anahtar URL'de (`?tip=kurumsal`) tutuluyor |
| 17 | Araç listesi sayfası (düzenlenebilir arama özeti, fotoğraf, bilgi, günlük ve toplam fiyat) + filtreler + boş/yükleniyor/hata durumları · **v0.3:** kartta Kirala → Y20 | FE | 16 | Filtre sonuç vermezse anlamlı boş durum |
| 18 | ~~Araç detay + ek hizmet seçimi + güvence şeridi~~ **Kaldırıldı (v0.3):** detay sayfası yok; ek hizmet seçimi ve güvence şeridi özete taşınır (Y20) | FE | 17 | |
| 19 | Rezervasyon özeti (kalem kalem fiyat, "gizli ücret yok") · **v0.3:** ek hizmet seçimi de burada (Y20) | FE | 18 | Toplam doğru hesaplanıyor |
| 20 | Sahte ödeme + onay sayfası | FE | 19, 26 | Para alınmadığı ekranda açıkça yazıyor |
| 21 | `GET /branches`, `GET /vehicles` (tarih + lokasyon ile müsaitlik; `?currency=` alır, tutarları `{ amount, currency }` döner) · **v0.3:** model/araç ayrımı ve tüketim → Y33 | BE | 15 | Dolu tarihli araç listede çıkmıyor |
| 22 | `POST /reservations`, `GET /me/reservations` (rezervasyon seçilen para birimini ve o anki kuru kaydeder) | BE | 21, 25 | Çakışan rezervasyon reddediliyor |

## M3 · Hesap

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 23 | Giriş, kayıt, şifremi unuttum sayfaları | FE | 9 | Hata mesajları alanın yanında |
| 24 | Profil: Hesabım, Rezervasyonlarım, Ayarlar (dil, tema, hesap silme) | FE | 23 | |
| 25 | Auth: kayıt, giriş, çıkış, httpOnly çerez, argon2 | BE | 14 | Şifre veritabanında düz metin değil |
| 26 | Ödeme öncesi giriş zorunluluğu (giriş sonrası akışa geri dönüş) | İKİ | 19, 25 | Girişten sonra özet ekranına geri dönülüyor |
| 27 | Şifre sıfırlama (e-posta yerine konsola log, gerçek e-posta kapsam dışı) | BE | 25 | |
| 28 | Hesap silme + kullanıcı ayarlarının kaydı | BE | 25 | |

## M4 · İçerik sayfaları ve kurumsal

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 29 | Ürünler listesi + ürün detay sayfaları (4 ürün) · **v0.3:** içerik değişti (SPEC Ek A) → Y23 | FE | 10 | "En çok tercih edilen" öne çıkıyor |
| 30 | Hizmetler sayfası (açılır-kapanır) · **v0.3:** içerik değişti (SPEC Ek A) → Y23 | FE | 9 | |
| 31 | Hakkımızda: metin, zaman çizelgesi, sürdürülebilirlik, sayaçlar · **v0.3:** eğri zaman çizelgesi, sayaç animasyonu, rakamlar → Y24 | FE | 10 | Sürdürülebilirlik iddiaları rakamlı |
| 32 | Kurumsal teklif sayfası (ana sayfa ön formundan dolu gelir) · **v0.3:** kurumsal akış form + görüşme; sayfanın akıbeti açık karar (SPEC §10) → Y16 | FE | 16 | |
| 33 | `POST /quotes` (ürün slug'ı isteğe bağlı), `GET /faq?audience=`, `GET /products`, `GET /products/:slug`, `GET /services` · **v0.3:** `POST /contact` → Y34 | BE | 15 | |
| 34 | İletişim: Google Maps, bayi arama, harita ↔ liste geçişi · **v0.3:** genel merkez, departman e-postaları, form, şehir filtresi → Y22 | FE | 21 | Harita yüklenmezse liste görünüyor |
| 35 | Google Maps API anahtarı: referrer kısıtlaması + kota | BE | — | Anahtar başka domainde çalışmıyor |
| 36 | Yasal sayfalar (KVKK, çerez, kiralama koşulları) + 404 · **v0.3:** gizlilik politikası, kullanım şartları, 500 → Y25, Y28 | FE | 10 | |

## M5 · Kalite ve yayın

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 37 | Playwright uçtan uca testler (SPEC §8) | İKİ | M2–M4 | CI'da yeşil |
| 38 | Erişilebilirlik ve performans denetimi · **v0.3:** Core Web Vitals hedefi (SPEC §9) → Y32 | FE | M4 | Raporlanan sorunlar kapandı |
| 39 | Güvenlik gözden geçirmesi (auth, CSRF, rate limit, girdi doğrulama; tarayıcı API'ye Next proxy ile gittiği için CORS yalnızca doğrudan erişim kalırsa) | BE | M3 | |
| 40 | Yayın: web + api + veritabanı | İKİ | 37 | Canlı adreste SPEC §8 akışı geçiyor |

## M6 · Sonradan eklenenler

Sonradan alınan kararlardan doğan işler (ARCHITECTURE ADR-14 ile ADR-17). Issue açılınca numarayı buraya yaz.

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| Y1 | Kur tablosu (`ExchangeRate`), günde bir kez dış servisten güncelleme görevi, `GET /rates` | BE | 14 | Servis kapalıyken son bilinen kur kullanılıyor |
| Y2 | Fiyat uçlarında `?currency=` ve `{ amount, currency }` cevabı; rezervasyonda kur anlık görüntüsü | BE | 21, 22, Y1 | EUR istenince tutar günlük kurla çevrilmiş geliyor |
| Y3 | Para birimi seçici (footer + profil ayarları), `Money` tipi ve `formatMoney` | FE | 10 | Seçim çerezde kalıyor, her iki dilde doğru biçim |
| Y4 | Next proxy: `/api/*` → API (`API_URL`) | FE | 2 | Çerez proxy'den geçiyor, `API_URL` yokken site çalışıyor |
| Y5 | Ürün ve hizmet sayfalarını API'ye bağla (`/products`, `/services`) | FE | 12, 33 | Metinler API'den geliyor, yükleniyor/boş/hata durumları var |
| Y6 | Backend çerez ayarları: `httpOnly`, `Secure`, `SameSite=Lax`; route'lar `/api` öneksiz | BE | 25 | Proxy üzerinden giriş yapılıp oturum sürüyor |
| Y7 | Tarih ve saat dilimini `Europe/Istanbul`'a sabitle | FE | 8 | Aynı rezervasyon her ortamda aynı yazılıyor |
| Y8 | Araçlarımız sayfası (`/araclarimiz`) ve menü öğesi; araç kartı, yer tutucu görsel, örnek veri katmanı (`USE_MOCKS=1`) | FE | 10 | Tüm marka ve modeller sınıfa göre listeleniyor, fiyat seçilen para biriminde |
| Y9 | Ana sayfa arama formu (bayi seçici + bayideki araçların önizlemesi, bırakılacak bayi, tarih-saat, Kirala) ve sonuç sayfası `/araclar` (#16 ve #17'nin bayi/araç kısmı; kitle anahtarı, SSS ve Yol Boyu Güvence bandı #16'da kalır) | FE | 10, Y8 | Aynı arama adresten paylaşılıp düzenlenebiliyor; boş, hata ve arama-yok durumları var |

## M7 · Site güncellemesi (9 Ekim 2026, SPEC v0.3)

**Sıra önemlidir.** "Sıra" sütunu çalışma ve birleştirme sırasıdır; "Bağımlı" sütunu kesin kısıttır. Zincir oluşmaması için bir iş, bağımlı olduğu işler `main`'e girdikten sonra `main`'den dallanır. Sıra değişecekse önce G'ye sorulur. Her satır ayrı dal, ayrı PR.

Sıranın gerekçesi:
1. **Önce zemin.** Build alınmadan hiçbir iş doğrulanamaz. Birleşmemiş 8 dal `main`'e girmeden üzerlerine iş kurulursa aynı dosyalarda çakışır.
2. **Ortak parçalar önce.** Örnek veri (rakamlar, tüketim), SEO yardımcısı ve navbar sonraki sayfaların hepsinde kullanılır.
3. **Sonra G'nin mesajındaki sırayla:** ana sayfa (galeri → kurumsal kutu → iş birlikleri → SSS → footer), arama ve kiralama, Araçlarımız, İletişim, içerik sayfaları.
4. **Yasal sayfalar, çerez ve SEO tamamlama en sonda.** Yeni sayfalar oluştuktan sonra sitemap, footer linkleri ve güvenlik başlıkları bir kez güncellenir.

Sıra ve öneri dosyasındaki ek kalite maddeleri G tarafından 10 Ekim 2026'da onaylandı.

**GitHub issue numaraları (10 Ekim 2026):** Y10 #78 · Y11 #79 · Y12 #80 · Y13 #81 · Y14 #82 · Y15 #83 · Y16 #84 · Y17 #85 · Y18 #86 · Y19 #87 · Y20 #88 · Y21 #89 · Y22 #90 · Y23 #91 · Y24 #92 · Y25 #93 · Y26 #94 · Y27 #95 · Y28 #96 · Y29 #97 · Y30 #98 · Y31 #99 · Y32 #100 · Y33 #101 · Y34 #102 · Y35 #103. Commit ve PR'da bu issue numaraları kullanılır. Y1–Y9 için issue açılmadı (Y3, Y4, Y7, Y8, Y9 zaten `main`'de; Y1, Y2, Y5, Y6 backend/API gelince).

| Sıra | # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| **0 · Zemin** | | | | | |
| 1 | Y10 | Build sorununu çöz (`ERR_SWC_NATIVE_CACHE`). Çözüm: kullanıcı ortam değişkeni `SWC_NATIVE_BINDING_CACHE` kısa bir klasöre (`C:\Users\karad\.swc-cache`) ayarlanır; varsayılan önbellek `AppData\Local` altında ve o klasörün izinleri SWC'nin güvenlik kontrolüne takılıyor, proje içindeki yol ise Windows'un 260 karakter sınırını aşıyor | FE (G) | — | `pnpm build` ve `pnpm typecheck` bu makinede geçiyor |
| 2 | Y11 | 9 Ekim'de bekleyen 8 dalı 375/768/1280'de doğrula ve birleştir. 10 Ekim itibarıyla B zinciri (`vehicle-detail` → `booking-summary` → `payment`), `contact-page`, `seo-assets` ve `chore/a11y-audit` `main`'de (#71–#75) ve `main` build alıyor, ama tarayıcıda doğrulanmadı. Kalan: bu altısının tarayıcı kontrolü, sonra A zinciri (`home-audience` → `corporate-quote`). Araç detayının kaldırılması Y20'de | FE | Y10 | 8 dal `main`'de; altısı tarayıcıda kontrol edildi; A zincirinin PR'larında ekran görüntüleri |
| **1 · Ortak temel** | | | | | |
| 3 | Y12 | Örnek veri ve rakamlar (SPEC §4.1): 14 şehirde 15 bayi, 15 model, tüketim alanı, model slug'ı | FE | Y11 | Araçlarımız 15 model, bayiler 14 şehir |
| 4 | Y13 | SEO temeli (ADR-18): `lib/seo.ts` ile tüm sayfalarda canonical ve dil eşlemesi, ana sayfa meta açıklaması, robots.txt'ten özel sayfaların çıkarılması, özet/ödeme/onayda `noindex` | FE | Y11 | Her sayfanın HTML'inde canonical ve iki dil bağlantısı var |
| 5 | Y14 | Navbar: İletişim vurgusu (masaüstü ve mobil menü) | FE | Y11 | 375/768/1280'de farklı görünüyor; kontrast ve odak AA |
| **2 · Ana sayfa** | | | | | |
| 6 | Y15 | Ana sayfa yerleşimi ve kampanya galerisi: yeni bölüm sırası, `h1` kutuda, arama butonu "Ara", araç sınıfları ve ürün kartları kalkar, Yol Boyu Güvence bandı yer değiştirir | FE | Y13 | SPEC §2.2 sırası; galeri klavye ve dokunmatikle gezilebiliyor; ilk görsel öncelikli |
| 7 | Y16 | Kurumsal kutu: **önce tasarım önerisi ve G onayı**, sonra form + görüşme akışı. Ortak form parçaları (tuzak alan, KVKK onayı, başarı durumu; ADR-20) | FE | Y15 | G onayladı; örnek veriyle gönderim başarılı, kapalıyken hata durumu |
| 8 | Y17 | İş birlikleri şeridi: 8 kurgusal SVG logo, durdurma düğmesi | FE | Y15 | Reduced-motion'da duruyor; ekran okuyucu logoları bir kez okuyor |
| 9 | Y18 | SSS: Bireysel/Kurumsal sekmeleri, yaylı açılma, iletişim çağrısı | FE | Y15 | Açık sekme kutudaki seçimi izliyor; klavyeyle tam kullanılabilir |
| 10 | Y19 | Footer (Simple Footer referansı) | FE | Y11, G'nin ekran görüntüsü | 375/768/1280'de doğru |
| **3 · Kiralama akışı** | | | | | |
| 11 | Y20 | Arama sonuçlarında **Kirala** → rezervasyon özeti; araç detay sayfası kalkar, ek hizmet seçimi ve güvence şeridi özete taşınır | FE | Y11 | SPEC §2.3 akışı uçtan uca çalışıyor; `/araclar/:slug` yok |
| **4 · Araçlarımız** | | | | | |
| 12 | Y21 | Araçlarımız kartı (tüketim, ok, hover) ve pencere (`?arac=`, ADR-22) | FE | Y12 | Paylaşılan link pencereyi açık getiriyor; Esc ve geri tuşu kapatıyor; odak karta dönüyor |
| **5 · İletişim** | | | | | |
| 13 | Y22 | İletişim: genel merkez, departman e-postaları, iletişim formu, şehir filtresi (liste ve pinler) | FE | Y12, Y16 | SPEC §2.6; "İzmir" seçilince liste ve pinler daralıyor; form örnek veriyle gönderiliyor |
| **6 · İçerik sayfaları** | | | | | |
| 14 | Y23 | Ürünler ve Hizmetler içeriği (SPEC Ek A): yeni slug'lar, ürün bölüm başlıkları, hizmet maddeleri, İngilizce çeviri | FE | Y11 | Metin Ek A ile aynı; tasarım değişmedi |
| 15 | Y24 | Hakkımızda: eğri zaman çizelgesi (Hikayemiz), sayaçlar, rakam düzeltmesi (SPEC §2.7, §4.1) | FE | Y12 | Reduced-motion'da statik; rakamlar §4.1 ile aynı |
| **7 · Yasal, çerez, analytics** | | | | | |
| 16 | Y25 | Gizlilik politikası ve kullanım şartları sayfaları; footer linkleri; KVKK metnine iletişim formu verisi | FE | Y19 | İki dilde; footer'dan erişiliyor |
| 17 | Y26 | Çerez onayı: bant, ayar penceresi, footer'da "Çerez tercihleri" (ADR-19) | FE | Y25 | "Reddet" seçilince analytics HTML'de yok |
| 18 | Y27 | Analytics (çerezsiz araç, yalnızca onayla) | FE | Y26, analytics aracı kararı | Onaylı bir ziyaret araçta görünüyor |
| 19 | Y28 | 500 hata sayfası (ADR-23) | FE | Y11 | Bilerek atılan hatada markalı sayfa çıkıyor |
| **8 · SEO tamamlama ve kalite** | | | | | |
| 20 | Y29 | JSON-LD, Open Graph metinleri, sitemap'e yeni sayfalar, `llms.txt`, web manifest ve `theme-color` | FE | Y25 | JSON-LD şema doğrulayıcıdan hatasız geçiyor; sitemap tüm herkese açık sayfaları içeriyor |
| 21 | Y30 | Güvenlik başlıkları: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` | FE | Y27 | Başlıklar yanıtta var; harita, analytics ve formlar çalışıyor |
| 22 | Y31 | CI'da kırık link kontrolü | FE | Y29 | Bilerek kırılan bir link CI'ı kırmızı yapıyor |
| 23 | Y32 | Hız: Core Web Vitals hedefleri (SPEC §9), mobil Lighthouse raporu ve düzeltmeler | FE | Y15–Y29 | LCP, INP, CLS hedefte; rapor PR'da |

**Backend (paralel).** Frontend örnek veriyle ilerlediği için bunları beklemez; uçlar gelince örnek veri kapatılır.

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| Y33 | Model ve fiziksel araç ayrımı, tüketim alanı; seed'i SPEC §4.1'e göre güncelle | BE | #6, #14, #15 | Araçlarımız modelleri ve bayilerini tek istekle alıyor |
| Y34 | `POST /contact`: `ContactMessage`, tuzak alan reddi, hız sınırı, KVKK onay zamanı (ADR-20) | BE | #6, #14 | Tuzak alanı dolu istek reddediliyor |
| Y35 | `POST /quotes` alanlarını onaylanan kurumsal tasarıma göre güncelle | BE | Y16 | Kurumsal form gerçek uca gönderiliyor |

---

## İlk gün ne yapılır?

1. **Birlikte (#1, #2):** Repo ve iskelet. Bunu aynı anda, görüntülü konuşarak yapmak en kolayı.
2. **Sonra ayrılırsınız:**
   - G: #3 → #7 → #9
   - Arkadaş: #4 → #13 → #14
3. **#6 API sözleşmesi:** Biriniz taslağı PR olarak açar, diğeri review eder. M2'ye geçmeden bitmiş olmalı.
