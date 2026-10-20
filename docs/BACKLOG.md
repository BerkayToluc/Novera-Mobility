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
5. **10 Ekim değişikliği (G onayladı):** yeni renk paleti her sayfayı etkilediği için en öne alındı; ardından navbar (tercihler footer'dan buraya taşınıyor) ve footer; sonra ana sayfa; Araçlarımız'dan hemen önce örnek veri.
6. **10 Ekim ek kapsam (G):** navbar açılır menüleri ve para birimi menüsü navbar aşamasına; mobil uygulama bölümü ve rehberler ana sayfa aşamasına; yardım İletişim'in yanına; giriş sekmeleri, ayarlar, puan ve seyahatler yeni "Hesap" aşamasına (auth backend'e bağlı oldukları için içerik sayfalarından sonra).

Sıra ve öneri dosyasındaki ek kalite maddeleri G tarafından 10 Ekim 2026'da onaylandı.

**GitHub issue numaraları (10 Ekim 2026):** Y10 #78 · Y11 #79 · Y12 #80 · Y13 #81 · Y14 #82 · Y15 #83 · Y16 #84 · Y17 #85 · Y18 #86 · Y19 #87 · Y20 #88 · Y21 #89 · Y22 #90 · Y23 #91 · Y24 #92 · Y25 #93 · Y26 #94 · Y27 #95 · Y28 #96 · Y29 #97 · Y30 #98 · Y31 #99 · Y32 #100 · Y33 #101 · Y34 #102 · Y35 #103 · Y36 #107 · Y37 #108 · Y38 #112 · Y39 #109 · Y40 #110 · Y41 #111 · Y42 #113 · Y43 #114 · Y44 #115 · Y45 #116 · Y46 #117 · Y47 #118. Commit ve PR'da bu issue numaraları kullanılır. Y1–Y9 için issue açılmadı (Y3, Y4, Y7, Y8, Y9 zaten `main`'de; Y1, Y2, Y5, Y6 backend/API gelince).

| Sıra | # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| **0 · Zemin** | | | | | |
| 1 | Y10 | Build sorununu çöz (`ERR_SWC_NATIVE_CACHE`). Çözüm: kullanıcı ortam değişkeni `SWC_NATIVE_BINDING_CACHE` kısa bir klasöre (`C:\Users\karad\.swc-cache`) ayarlanır; varsayılan önbellek `AppData\Local` altında ve o klasörün izinleri SWC'nin güvenlik kontrolüne takılıyor, proje içindeki yol ise Windows'un 260 karakter sınırını aşıyor | FE (G) | — | `pnpm build` ve `pnpm typecheck` bu makinede geçiyor |
| 2 | Y11 | 9 Ekim'de bekleyen 8 dalı 375/768/1280'de doğrula ve birleştir. 10 Ekim itibarıyla B zinciri (`vehicle-detail` → `booking-summary` → `payment`), `contact-page`, `seo-assets` ve `chore/a11y-audit` `main`'de (#71–#75) ve `main` build alıyor, ama tarayıcıda doğrulanmadı. Kalan: bu altısının tarayıcı kontrolü, sonra A zinciri (`home-audience` → `corporate-quote`). Araç detayının kaldırılması Y20'de | FE | Y10 | 8 dal `main`'de; altısı tarayıcıda kontrol edildi; A zincirinin PR'larında ekran görüntüleri |
| **1 · Renk ve çerçeve (10 Ekim'de öne alındı)** | | | | | |
| 3 | Y36 | Renk paleti "Zeytin ve Ege" (SPEC §5.1): token'lar, açık tema varsayılan ve sayfa zemini beyaz, metin seçimi ve imleç rengi paletten; logo, favicon ve paylaşım görseli yeni renkte | FE | Y11 | Tüm renkler yeni palette; açık ve koyu temada AA; çerez yokken site açık temada |
| 4 | Y14 | Navbar: İletişim farklı görünür ve diğer linklerden boşlukla ayrılır; Giriş Yap butonu zeminden ayrışır; para birimi kendi simgeli açılır menüsünde (`₺ TRY`); dil ve tema tek düğmeyle açılan panelde (mobilde hamburger menüde); footer'dan tercihler kalkar | FE | Y36 | 375/768/1280'de doğru; menü ve panel klavyeyle kullanılabilir; kontrast ve odak AA |
| 5 | Y37 | Navbar'da Ürünler ve Hizmetler açılır menüleri: öğeler listelenir (4 ürün, 5 hizmet); mobilde alt liste | FE | Y14 | Menü klavyeyle açılıp gezilebiliyor, Esc kapatıyor; her öğe doğru sayfaya gidiyor |
| 6 | Y19 | Footer (Simple Footer referansı): solda logo, tanım ve telif; sağda Keşfet, Yasal ve iletişim sütunları; "Bizi takip edin" ikonları (tıklanamaz); tercihler yok | FE | Y14 | 375/768/1280'de doğru |
| **2 · Ana sayfa** | | | | | |
| 7 | Y15 | Ana sayfa yerleşimi ve kampanya galerisi: yeni bölüm sırası; "Araç Kirala" başlığı ve Bireysel/Kurumsal butonları ortalanır, butonların çevresindeki kutu kalkar; arama butonu "Ara"; "Size uygun sınıfı seçin" ve ürün kartları kalkar; Yol Boyu Güvence bandı modernleştirilir | FE | Y14 | SPEC §2.2 sırası; galeri klavye ve dokunmatikle gezilebiliyor; ilk görsel öncelikli |
| 8 | Y16 | Kurumsal kutu: **önce tasarım önerisi ve G onayı**, sonra form + görüşme akışı. Ortak form parçaları (tuzak alan, KVKK onayı, başarı durumu; ADR-20) | FE | Y15 | G onayladı; örnek veriyle gönderim başarılı, kapalıyken hata durumu |
| 9 | Y17 | İş birlikleri şeridi: 8 kurgusal SVG logo, durdurma düğmesi | FE | Y15 | Reduced-motion'da duruyor; ekran okuyucu logoları bir kez okuyor |
| 10 | Y18 | SSS: Bireysel/Kurumsal sekmeleri, yaylı açılma, iletişim çağrısı; farklı bayiye bırakma cevabı "ek ücret yoktur" olarak düzeltilir (G, 10 Ekim) | FE | Y15 | Açık sekme kutudaki seçimi izliyor; klavyeyle tam kullanılabilir |
| 11 | Y39 | Ana sayfada mobil uygulama reklamı bölümü (fotoğraf + metin + mağaza rozetleri; rozetler bağlantı değil) | FE | Y15 | 375/768/1280'de doğru; görselde alt metin; rozetler gerçek mağazaya gitmiyor |
| 12 | Y40 | Araç kiralama rehberleri: `/rehberler` liste ve rehber sayfaları (4–6 rehber, iki dilde), ana sayfada 3–4 kart | FE | Y15 | Rehberler iki dilde açılıyor; ana sayfadaki kartlar doğru rehbere gidiyor; sitemap'e eklenmesi Y29'da |
| **3 · Araçlarımız** | | | | | |
| 13 | Y12 | Örnek veri ve rakamlar (SPEC §4.1): 14 şehirde 15 bayi, 15 model, tüketim alanı, model slug'ı | FE | Y11 | Araçlarımız 15 model, bayiler 14 şehir |
| 14 | Y21 | Araçlarımız: yatay araç kartları (tüketim, ok, hover), üstte kategori çipleri ve belirgin kategori bölümleri, karta tıklayınca pencere (`?arac=`, ADR-22) | FE | Y12 | Çip seçilince liste süzülüyor; paylaşılan link pencereyi açık getiriyor; Esc ve geri tuşu kapatıyor; odak karta dönüyor |
| **4 · SEO temeli ve kiralama akışı** | | | | | |
| 15 | Y13 | SEO temeli (ADR-18): `lib/seo.ts` ile tüm sayfalarda canonical ve dil eşlemesi, ana sayfa meta açıklaması, robots.txt'ten özel sayfaların çıkarılması, özet/ödeme/onayda `noindex`; `/apple-icon` ve paylaşım görseli 404'ü (`proxy.ts` eşleşmesi) ve eksik `og:image` | FE | Y11 | Her sayfanın HTML'inde canonical ve iki dil bağlantısı var |
| 16 | Y20 | Arama sonuçlarında **Kirala** → rezervasyon özeti; araç detay sayfası kalkar, ek hizmet seçimi ve güvence şeridi özete taşınır. Özet toplamı `POST /reservations/price`'tan gelir (frontend hesaplamaz), "KDV dahil" yazar; Kirala'da 15 dakikalık tutma ve geri sayım, süre dolunca ve çakışmada ayrı durum ekranı (SPEC §2.3) | FE | Y11, Y48 | SPEC §2.3 akışı uçtan uca çalışıyor; `/araclar/:slug` yok; geri sayım ve iki durum ekranı var |
| **5 · İletişim ve yardım** | | | | | |
| 17 | Y22 | İletişim: genel merkez, departman e-postaları, iletişim formu, şehir filtresi (liste ve pinler) | FE | Y12, Y16 | SPEC §2.6; "İzmir" seçilince liste ve pinler daralıyor; form örnek veriyle gönderiliyor |
| 18 | Y41 | Yardım merkezi `/yardim`: konulara göre sorular, arama, rehber bağlantıları, İletişim'e yönlendirme (İletişim'den ayrı sayfa) | FE | Y40 | Arama sonuç vermezse İletişim'e yönlendiriyor; navbar ya da footer'dan erişiliyor |
| **6 · İçerik sayfaları** | | | | | |
| 19 | Y23 | Ürünler ve Hizmetler içeriği (SPEC Ek A): yeni slug'lar, ürün bölüm başlıkları, hizmet maddeleri, İngilizce çeviri | FE | Y11 | Metin Ek A ile aynı; tasarım değişmedi |
| 20 | Y24 | Hakkımızda: eğri zaman çizelgesi (Hikayemiz), sayaçlar, rakam düzeltmesi (SPEC §2.7, §4.1) | FE | Y12 | Reduced-motion'da statik; rakamlar §4.1 ile aynı |
| **7 · Hesap** | | | | | |
| 21 | Y38 | Girişte Bireysel ve Kurumsal sekmeleri; kurumsal hesap sayfası (firma bilgisi, teklif talepleri) | FE | Y11 | Sekme adreste (`?tip=kurumsal`); kurumsal girişte kurumsal hesap sayfası açılıyor (örnek veriyle) |
| 22 | Y42 | Profil Ayarlar: varsayılan para birimi, dil ve tema hesaba kaydedilir ve girişte uygulanır | FE | Y38 | Ayar kaydedilip yeniden girişte geri geliyor (örnek veriyle) |
| 23 | Y43 | Puanlarım (`/profil/puanlar`): bakiye, kazanım geçmişi, kurallar; rezervasyon onayında kazanılan puan | FE | Y42 | Örnek veriyle bakiye ve geçmiş görünüyor; boş ve hata durumları var |
| 24 | Y44 | Rezervasyonlarım: yaklaşan ve geçmiş seyahatler ayrı; her seyahatte kazanılan puan | FE | Y43 | İki liste doğru ayrılıyor; boş durumlar anlamlı |
| **8 · Yasal, çerez, analytics** | | | | | |
| 25 | Y25 | Gizlilik politikası ve kullanım şartları sayfaları; footer linkleri; KVKK metnine iletişim formu verisi | FE | Y19 | İki dilde; footer'dan erişiliyor |
| 26 | Y26 | Çerez onayı: bant, ayar penceresi, footer'da "Çerez tercihleri" (ADR-19) | FE | Y25 | "Reddet" seçilince analytics HTML'de yok |
| 27 | Y27 | Analytics (çerezsiz araç, yalnızca onayla) | FE | Y26, analytics aracı kararı | Onaylı bir ziyaret araçta görünüyor |
| 28 | Y28 | 500 hata sayfası (ADR-23) | FE | Y11 | Bilerek atılan hatada markalı sayfa çıkıyor |
| **9 · SEO tamamlama ve kalite** | | | | | |
| 29 | Y29 | JSON-LD, Open Graph metinleri, sitemap'e yeni sayfalar, `llms.txt`, web manifest ve `theme-color` | FE | Y25 | JSON-LD şema doğrulayıcıdan hatasız geçiyor; sitemap tüm herkese açık sayfaları içeriyor |
| 30 | Y30 | Güvenlik başlıkları: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` | FE | Y27 | Başlıklar yanıtta var; harita, analytics ve formlar çalışıyor |
| 31 | Y31 | CI'da kırık link kontrolü | FE | Y29 | Bilerek kırılan bir link CI'ı kırmızı yapıyor |
| 32 | Y32 | Hız: Core Web Vitals hedefleri (SPEC §9), mobil Lighthouse raporu ve düzeltmeler | FE | Y15–Y29 | LCP, INP, CLS hedefte; rapor PR'da |
| **10 · Navbar ve sayfa düzeni (11 Ekim, SPEC v0.5)** | | | | | |
| 33 | Y49 | Navbar: yüzen açık hap (Framer "Modern Navbar"), Bayilerimiz linki, tema navbardan kalkar, dil menüsü bayraklı, hesap simgesi, Hizmetler düz link, yalnızca Ürünler açılır (SPEC §2.8) | FE | Y14, Y37 | 375/768/1280'de doğru; menüler klavyeyle gezilebiliyor; axe temiz; tema kontrolü navbarda yok |
| 34 | Y50 | Bayilerimiz sayfası `/bayilerimiz`: bayi listesi, filtre, harita ve JSON-LD İletişim'den taşınır; İletişim'de yalnızca bağlantı (SPEC §2.6.1) | FE | Y49 | Filtre `/bayilerimiz`'de çalışıyor; İletişim'de bayi bölümü yok; sitemap'te var |
| 35 | Y51 | Filo ana sayfada: kiralama kutusunun altında kategori çipli bölüm ("Tümü" yok, ilk kategori seçili), `/araclarimiz` kalkar, `?arac=` diğer parametreleri korur (SPEC §2.4) | FE | Y50 | Kart penceresi `/`'de açılıp Esc ile kapanıyor, odak karta dönüyor; eski rota ve nav öğesi yok |
| 36 | Y52 | Sürücü uygunluğu (SPEC §2.10): sınıf ve ehliyet ülkesine göre kural tablosu, `/odeme`'de "Sürücü bilgileri" (doğum tarihi, ülke, simüle ehliyet doğrulama, beyan), sunucu eyleminde yeniden kontrol, karar öncesi koşul satırı; veri saklanmaz; KVKK metni güncellenir. Backend sözleşmesi (sınıf kuralı, 422) ayrı | FE | Y49 | Uygun ve uygun olmayan iki yol e2e'de; doğum tarihi adreste ve depolamada yok; axe temiz |
| 37 | Y53 | Ana sayfa rötuşları (SPEC v0.6): kurumsal süre 1/2/3 ay, bayi listesinde çalışma durumu, tek sütun araç kartı ve fiyat bloğu, şerit hover'da akar, güvence bandında akan çizgi, mağaza işaretleri, oklu rehber kaydırıcı, konu sekmeli SSS | FE | Y49–Y52 | Her bölüm 375/768/1280'de doğru; axe temiz; durdur düğmesi yok ve hareket kendiliğinden başlamıyor |
| 38 | Y54 | Footer Simple Footer (SPEC §2.8, v0.6): ↗ hover oku, bloklar yerine oturur, xl altında linkler önce | FE | Y49 | Footer e2e; reveal solma yok (axe kontrastı); 375/768/1280 |
| 39 | Y55 | Navbar hover (SPEC §2.8, v0.7): linklerde Framer SplitTextHover harf yuvarlama, Ürünler menüsü hover'la açılır ve kayan vurgu (Pill Dropdown Nav) | FE | Y49 | Lint, typecheck, build ve header e2e geçer; 375/768/1280; axe temiz; link adı tek okunur; hover'la açılınca odak yerinde kalır |
| 40 | Y56 | Ana sayfa v3 (SPEC §2.2, v0.7): galeri okları kartın sol/sağ kenarında buzlu şerit, iş birlikleri Logo 3D Carousel (kendiliğinden akar, hover/odakta durur), güvence bandı StepProgress (bir kez), rehber kartı hover, SSS satırları (Framer FAQs, tek açık) | FE | Y53 | Ana sayfa e2e (şerit hareket/durma, adımlar, oklar kenarlarda, SSS tek açık); reduced-motion'da durağan; axe temiz |
| 41 | Y57 | Footer v3 (SPEC §2.8, v0.7): wavy link hover, sosyal ikonlar (bağlantı değil, büyür, "yakında" etiketi), göz çifti 3x, boşluk düzeni | FE | Y54 | Footer e2e; 375/768/1280 taşma yok; axe temiz |
| 42 | Y58 | Smart Contact Link (SPEC §2.6, v0.7): e-posta adresleri gönder/kopyala balonu | FE | — | Balon açılır, kopyalar, Esc/dış tık/Tab kapatır, ekrandan taşmaz; e2e |
| 43 | Y59 | Hakkımızda: Sürdürülebilirlik rakamları görününce sayar (yüzde dahil) | FE | — | e2e: 0'dan değere sayar, ekran okuyucu değeri bir kez duyar, reduced-motion'da baştan değer |
| 44 | Y60 | Ürünler v2 (SPEC §2.5, v0.7): ton zeminli ürün kartları ve çizimler, ürün detayı hero + ikonlu kartlar + numaralı teknoloji + diğer çözümler | FE | — | Liste ve 4 detay iki dilde; e2e; 375/768/1280; axe temiz |
| 45 | Y61 | Uygun Araçlar: Filtrele paneli ve "Puanla öde" (SPEC §2.3, v0.7); `lib/vehicle-filters.ts`, `lib/points.ts` | FE | Y53 | Birim testleri (filtre, puan 1:1, en çok yarısı); e2e; puan yalnızca bireysel + TL |
| 46 | Y62 | Rezervasyon özeti: ara toplam, kampanya, puan ve KDV satırları; kampanya kodu ödemeden özete taşındı (SPEC §2.3, v0.7) | FE | Y61 | Birim ve e2e (KDV = toplamın 1/6'sı, puan kodundan sonra); ödeme sayfasında kod kutusu yok |
| 47 | Y63 | **Backend'e öneri:** `POST /reservations/price` gövdesine `usePoints` ve yanıta `points`/`vat` alanları; rezervasyon oluştururken harcanan puanın düşülmesi | BE | Y62 | OpenAPI güncel; ön yüzün mock'u yerine API kullanılır |
| 48 | Y64 | Puan değeri 1 puan = ₺5 (SPEC §2.3, §2.9, v0.8): anahtar, özet satırı, Puanlarım ve SSS'de yazar | FE | Y61 | Birim testleri (yarısı sınırı, ₺ karşılığı); e2e; metinler `POINT_VALUE`'dan biçimlenir |
| 49 | Y65 | Sürücü kuralı 18 yaş + geçerli ehliyet (SPEC §2.10, v0.8): sınıf ve ülke yıl tablosu kalktı, ABD için uluslararası belge kaldı | FE | Y52 | `tests/driver.test.ts`, `e2e/driver.spec.ts` yeni kural; kartlarda yaş/ehliyet satırı yok; Kiralama Koşulları metni güncel |
| 50 | Y66 | Sonuç kartları (SPEC §2.3, v0.8): toplam fiyat önce, 100 km tüketim, liste/ızgara görünümü, tek araç çubuğu | FE | Y61 | e2e (`results-cards`); 375/768/1280 taşma yok; axe temiz |
| 51 | Y67 | İletişim: "Size en yakın bayi" yerine Yardım merkezi kartı (SPEC §2.6, v0.8) | FE | — | e2e: kart `/yardim`'e gider, Bayilerimiz küçük bağlantı |
| 52 | Y68 | Profil kabuğu: karşılama başlığı, puan çipi, ikonlu yan menü, sıradaki seyahat ve hızlı işlemler (SPEC §2.9, v0.8) | FE | Y64 | e2e (`forms-account`); axe `/profil/*` temiz; iskelet sayfa düzeninde |
| 53 | Y69 | Rezervasyonlarım: durum çipleri, bayi adı ve saat, yol tarifi, bayiyi ara, simüle iptal (SPEC §2.9, v0.8) | FE | Y68 | e2e (`profile-trips`); iptal puanı düşürür |
| 54 | Y70 | Puanlarım ve Ayarlar: ₺ karşılığı, harcama bağlantısı; bildirim, şifre ve oturum bölümleri simüle (SPEC §2.9, v0.8) | FE | Y69 | e2e (`profile-settings`); axe temiz |
| 55 | Y71 | **Backend'e öneri:** rezervasyon iptali (`POST /me/reservations/{id}/cancel`, puan düşümü), bildirim tercihleri, şifre değiştirme, oturum listesi ve kapatma, puan harcama | BE | Y69 | OpenAPI güncel; ön yüzün çerez simülasyonları kalkar |
| 56 | Y72 | Hizmetler sayfası yenilendi (SPEC §2.5, v0.9): kart ızgarası, rakamlar, nasıl işler, paket etiketleri, ürün tablosu, acil durum bandı | FE | Y58 | e2e (`services`); 375/768/1280 taşma yok; axe temiz; eski `?hizmet=N#hizmet-N` bağlantıları çalışır |
| 57 | Y73 | Telefon numaralarında gönder/kopyala balonu (SPEC §2.6, v0.9) | FE | Y58 | e2e: iletişim, bayi kartı, acil hat |
| 58 | Y74 | Kurumsal teklifte seçili ürün şeridi (SPEC §2.2.3, v0.9) | FE | Y60 | e2e (`products`): şerit görünür, kaldırılır, form alanı dolu |
| 59 | Y75 | e2e: beklenen koşullar için 10 sn bekleme (yük altında giriş yönlendirmesi) | FE | — | Tam takım iki koşuda hatasız |
| 60 | Y76 | Sonuç çubuğu (SPEC §2.3, v0.10): anahtarda bakiye yok, üstü çizili toplam + "puan + kalan", tek görünüm düğmesi, 768'de fiyat alt satırda | FE | Y66 | e2e (`results-cards`, `results-filters`); 375/768/1280 görüntü; axe |
| 61 | Y77 | Kurumsal teklif: teslim şehirleri 81 ilden ilk harflerle seçilir (SPEC §2.2.3, v0.10) | FE | Y74 | Birim (81 il, sıra, 200 karakter sınırı); e2e (`quote-cities`): İ listesi, klavye, kaldırma, serbest yazı yok |
| 62 | Y78 | Duyarlılık taraması ve düzeltmeleri (SPEC §5.7, v0.10): 320 px üst çubuk, sosyal etiketler, rozet düğmeleri, taşma koruma testi | FE | — | 7 genişlikte tam tarama temiz; `e2e/responsive.spec.ts` |

**Backend (paralel).** Frontend örnek veriyle ilerlediği için bunları beklemez; uçlar gelince örnek veri kapatılır.

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| Y33 | Model ve fiziksel araç ayrımı, tüketim alanı; seed'i SPEC §4.1'e göre güncelle | BE | #6, #14, #15 | Araçlarımız modelleri ve bayilerini tek istekle alıyor |
| Y34 | `POST /contact`: `ContactMessage`, tuzak alan reddi, hız sınırı, KVKK onay zamanı (ADR-20) | BE | #6, #14 | Tuzak alanı dolu istek reddediliyor |
| Y35 | `POST /quotes` alanlarını onaylanan kurumsal tasarıma göre güncelle | BE | Y16 | Kurumsal form gerçek uca gönderiliyor |
| Y45 | Hesap türü (bireysel / kurumsal), kurumsal giriş ve firma bilgisi; kurumsal hesabı Novera açar (SPEC §2.9, §10) | BE | #25 (Auth) | Kurumsal kullanıcı girişte kurumsal hesap bilgisini alıyor |
| Y46 | Puan sistemi: rezervasyonda puan kazanımı, `GET /me/points` (bakiye + geçmiş), kural metni (SPEC §2.9) | BE | #22, #25 | Tamamlanan rezervasyon puan ekliyor; iptal edilen eklemiyor |
| Y47 | Kullanıcı tercihleri: varsayılan para birimi, dil, tema hesapta (#28'in genişlemesi) | BE | #28 | Tercih kaydedilip girişte dönüyor |
| Y48 | Araç tutma: Kirala'da seçilen araç 15 dakika tutulur, süre dolunca serbest kalır; tutulan araç başka aramada müsait görünmez; tutma bitiş zamanı ISO 8601 UTC döner; çakışma `409 VEHICLE_UNAVAILABLE` (SPEC §2.3, ARCHITECTURE "Backend ile netleşecekler") | BE | #21, #22 | İki oturum aynı aracı alamıyor; 15 dakika sonra araç yeniden müsait |

## M8 · Yönetim paneli ve ürün/hizmet içeriği (20 Ekim 2026, SPEC v0.11)

Açıklama, sıra ve görev dağılımı: [ROADMAP.md](ROADMAP.md); tasarım: [ADMIN.md](ADMIN.md) ve [FLEET.md](FLEET.md). Sahip: **BE = Berkay, FE = G**. Her fazda önce BE işi `main`'e girer, sonra o fazın FE işi başlar. Y5 (ürün ve hizmet sayfalarını API'ye bağla) Y84'tür.

| # | İş | Sahip | Bağımlı |
|---|---|---|---|
| Y79 | Belgeler: SPEC v0.11, ADR-24, ADR-25, ADMIN.md, FLEET.md, ROADMAP.md | İKİ | — |
| Y80 | Google ile giriş ön yüzü | FE | #258 |
| Y81 | Rol, `AdminGuard`, işlem kaydı, `admin:create`, `GET /admin/summary` | BE | Y79 |
| Y82 | Yönetim kabuğu, iki panelin ortak bileşenleri, Özet | FE | Y81 |
| Y83 | Ürün ve hizmet içerik modeli, seed, `/admin/products`, `/admin/services` | BE | Y81 |
| Y84 | Ürün ve hizmet sayfaları API'den (Y5) | FE | Y83 |
| Y85 | Yönetim > Ürünler ve Hizmetler | FE | Y82, Y83 |
| Y86 | `/admin/reservations`, `/admin/quotes`, `/admin/contact-messages` | BE | Y81 |
| Y87 | Yönetim > Rezervasyonlar, Teklifler, Mesajlar | FE | Y82, Y86 |
| Y88 | `/admin/promo-codes`, `/admin/faq` | BE | Y81 |
| Y89 | Kiralık filo uçları (modeller, bayiler, araçlar, ek hizmetler) | BE | Y81 |
| Y90 | Yönetim > Kampanya kodları ve SSS | FE | Y82, Y88 |
| Y91 | Yönetim > Kiralık filo | FE | Y82, Y89 |
| Y92 | `Company`, `/admin/companies` (kullanıcı daveti), `/admin/users` (devre dışı bırakma) | BE | Y81 |
| Y93 | Yönetim > Kurumsal müşteriler, Kullanıcılar, İşlem kaydı | FE | Y82, Y92 |

## M9 · Filom: kurumsal filo paneli (20 Ekim 2026, SPEC v0.11)

| # | İş | Sahip | Bağımlı |
|---|---|---|---|
| Y94 | Filom verisi (personel, sözleşme, filo aracı, zimmet, okuma), `CompanyGuard`, `/fleet/*` ilk uçlar, örnek şirket seed'i | BE | Y92 |
| Y95 | Yönetim > Sözleşmeler, filo araçları, okumalar (istisna: Berkay) | FE (Berkay) | Y82, Y94 |
| Y96 | Filom kabuğu: Özet, Araçlar, Personel, Zimmet, Sözleşmeler | FE | Y82, Y94 |
| Y97 | Faturalar ve masraflar (otomatik personel eşleme), yenileme talebi | BE | Y94 |
| Y98 | Yönetim > Faturalar ve Filo masrafları (istisna: Berkay) | FE (Berkay) | Y95, Y97 |
| Y99 | Filom > Faturalar ve Masraflar | FE | Y96, Y97 |
| Y100 | `/fleet/reports` (maliyet, kilometre, karbon, batarya) | BE | Y97 |
| Y101 | Filom > Raporlar | FE | Y96, Y100 |

## M10 · Yayın tamamlama (20 Ekim 2026)

| # | İş | Sahip | Bağımlı |
|---|---|---|---|
| Y102 | Rezervasyon onayı, hatırlatma ve kurumsal davet e-postaları | BE | Resend alan adı |
| Y103 | SECURITY.md açık kararları (hesap silmede doğrulama, giriş kilidi, açık uçlara hız sınırı) | BE | — |
| Y104 | Hesap silmede doğrulama alanı | FE | Y103 |
| Y105 | Fotoğraflar ve görsel sıkıştırma | FE | — |
| Y106 | Lighthouse ve ekran okuyucu denetimi (#47'nin kalanı) | FE | Y105 |
| Y107 | Canlı ortam tamamlama (site adresi, analytics, Maps anahtarı, anahtar kontrolü, yedek) | İKİ | — |
| Y108 | Son kabul (SPEC §8 canlıda, iki panel turu), STATUS.md v1, `v1.0.0` | İKİ | Hepsi |

Bitti sayılması için ölçütler ROADMAP §3'teki tablolarda. **GitHub issue numaraları:** issue'lar açılınca buraya yazılır.

---

## İlk gün ne yapılır?

1. **Birlikte (#1, #2):** Repo ve iskelet. Bunu aynı anda, görüntülü konuşarak yapmak en kolayı.
2. **Sonra ayrılırsınız:**
   - G: #3 → #7 → #9
   - Arkadaş: #4 → #13 → #14
3. **#6 API sözleşmesi:** Biriniz taslağı PR olarak açar, diğeri review eder. M2'ye geçmeden bitmiş olmalı.
