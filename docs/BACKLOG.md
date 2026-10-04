# Novera Mobility: İlk İş Listesi (Backlog)

> 4 Ekim 2026 · SPEC v0.2 ve ARCHITECTURE v0.1'e göre.
> Her satır GitHub'da bir issue olur. **Sahip:** FE = G (frontend), BE = arkadaş (backend), İKİ = birlikte.
> Kilometre taşları sırayla ilerler; bir taşın içindeki FE ve BE işleri **paralel** yürür.
> "Bağımlı" sütunu: o iş başlamadan bitmesi gereken iş.

---

## M0 · Kurulum (birlikte)

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 1 | GitHub reposu, collaborator, `main` koruması, Projects panosu | İKİ | — | İkiniz de push/PR açabiliyor; `main`'e doğrudan push reddediliyor |
| 2 | Monorepo iskeleti: pnpm workspaces, `apps/web`, `apps/api`, `docs/` | İKİ | 1 | `pnpm install` iki makinede de hatasız |
| 3 | SPEC ve ARCHITECTURE'ı `docs/` altına taşı, PR şablonu ekle | FE | 2 | PR açınca şablon görünüyor |
| 4 | CI: lint + tip kontrolü + test + build (GitHub Actions) | BE | 2 | Bilerek bozuk bir PR'da CI kırmızı |
| 5 | `CLAUDE.md`: proje kuralları (ham hex yok, metin çeviri dosyasında, mobile-first vb.) | FE | 2 | 200 satırdan kısa |
| 6 | API sözleşmesi v1: `openapi.yaml` (bayiler, araçlar, rezervasyon, teklif, auth, SSS) | İKİ | 2 | İkinizin onayıyla merge |

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
| 14 | Docker Compose ile PostgreSQL, Prisma şeması (User, Branch, VehicleClass, Vehicle, Extra, Reservation, QuoteRequest, FaqItem) | BE | 13 | `prisma migrate` iki makinede de çalışıyor |
| 15 | Seed verisi: ~15 bayi (gerçekçi şehir/koordinat), ~12 araç, SSS (bireysel + kurumsal) | BE | 14 | Tek komutla veritabanı doluyor |

## M2 · Kiralama akışı (bireysel)

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 16 | Ana sayfa: Bireysel/Kurumsal anahtarı, arama alanı, kitleye göre değişen bölümler, Yol Boyu Güvence bandı | FE | 10, 12 | Anahtar URL'de (`?tip=kurumsal`) tutuluyor |
| 17 | Araç listesi sayfası + filtreler + boş/yükleniyor/hata durumları | FE | 16 | Filtre sonuç vermezse anlamlı boş durum |
| 18 | Araç detay + ek hizmet seçimi + güvence şeridi | FE | 17 | |
| 19 | Rezervasyon özeti (kalem kalem fiyat, "gizli ücret yok") | FE | 18 | Toplam doğru hesaplanıyor |
| 20 | Sahte ödeme + onay sayfası | FE | 19, 26 | Para alınmadığı ekranda açıkça yazıyor |
| 21 | `GET /branches`, `GET /vehicles` (tarih + lokasyon + filtre ile müsaitlik) | BE | 15 | Dolu tarihli araç listede çıkmıyor |
| 22 | `POST /reservations`, `GET /me/reservations` | BE | 21, 25 | Çakışan rezervasyon reddediliyor |

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
| 29 | Ürünler listesi + ürün detay sayfaları (4 ürün) | FE | 10 | "En çok tercih edilen" öne çıkıyor |
| 30 | Hizmetler sayfası (açılır-kapanır) | FE | 9 | |
| 31 | Hakkımızda: metin, zaman çizelgesi, sürdürülebilirlik, sayaçlar | FE | 10 | Sürdürülebilirlik iddiaları rakamlı |
| 32 | Kurumsal teklif sayfası (ana sayfa ön formundan dolu gelir) | FE | 16 | |
| 33 | `POST /quotes`, `GET /faq?audience=` | BE | 15 | |
| 34 | İletişim: Google Maps, bayi arama, harita ↔ liste geçişi | FE | 21 | Harita yüklenmezse liste görünüyor |
| 35 | Google Maps API anahtarı: referrer kısıtlaması + kota | BE | — | Anahtar başka domainde çalışmıyor |
| 36 | Yasal sayfalar (KVKK, çerez, kiralama koşulları) + 404 | FE | 10 | |

## M5 · Kalite ve yayın

| # | İş | Sahip | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|
| 37 | Playwright uçtan uca testler (SPEC §8) | İKİ | M2–M4 | CI'da yeşil |
| 38 | Erişilebilirlik ve performans denetimi | FE | M4 | Raporlanan sorunlar kapandı |
| 39 | Güvenlik gözden geçirmesi (auth, CORS, rate limit, girdi doğrulama) | BE | M3 | |
| 40 | Yayın: web + api + veritabanı | İKİ | 37 | Canlı adreste SPEC §8 akışı geçiyor |

---

## İlk gün ne yapılır?

1. **Birlikte (#1, #2):** Repo ve iskelet. Bunu aynı anda, görüntülü konuşarak yapmak en kolayı.
2. **Sonra ayrılırsınız:**
   - G: #3 → #7 → #9
   - Arkadaş: #4 → #13 → #14
3. **#6 API sözleşmesi:** Biriniz taslağı PR olarak açar, diğeri review eder. M2'ye geçmeden bitmiş olmalı.
