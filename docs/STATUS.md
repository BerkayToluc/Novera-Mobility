# Proje durumu

Son güncelleme: 2026-10-09. Bu belge bir anlık görüntüdür; kalıcı kararlar ARCHITECTURE'a, kapsam SPEC'e, iş listesi BACKLOG'a aittir. Çelişki olursa onlar kazanır. Dalların `main`'de olup olmadığını bu belgeye değil `git fetch` sonrası git'e sorun.

Issue numarası = BACKLOG numarası + 9. PR gövdesinde ve commit'te **issue** numarası kullanılır.

## 0. En önemli sorun: doğrulama borcu

`main`'e girmemiş 8 dalın hiçbiri tarayıcıda açılıp denenmedi. Yazıldıkları makinede `pnpm build` ve dev sunucusu çalışmıyordu (SWC derleyicisi `%LOCALAPPDATA%` üzerindeki bir izin kaydını görüp reddediyor: `ERR_SWC_NATIVE_CACHE`). Bu 8 dalda yalnızca `pnpm lint` ve `tsc --noEmit` geçti. Bu, CLAUDE.md'deki "bitti" tanımını (lint + typecheck + build + 375/1280 ekran görüntüsü) karşılamaz.

Bu yüzden commit'ler `Closes` değil `Refs #N` taşıyor. Doğrulama yapılınca ilgili issue'lar için `Closes #N` PR gövdesine yazılır.

Yapılacak: SWC sorununu çöz (Claude uygulamasını yeniden başlat; olmazsa Claude dışındaki bir terminalden `pnpm build` dene), sonra 8 dalı sırayla build edip 375/768/1280'de kontrol et.

## 1. `main`'de olanlar

- İskelet, tasarım token'ları, i18n, tema, header/footer/mobil menü.
- Ürünler, Hizmetler, Hakkımızda, giriş/kayıt sayfaları.
- Next proxy (`/api/*` → `API_URL`), API kararları (ADR-14…17).
- Mesajların özellik başına bölünmesi (`messages/<dil>/<özellik>.json`), yasal sayfalar + 404, profil sayfaları, saat dilimi (`Europe/Istanbul`), para birimi seçici (TRY/EUR/USD), Araçlarımız, arama formu + `/araclar` sonuçları (kısmi: `Refs #25, #26`), README düzeltmeleri, CI'da typecheck.

## 2. Push'lu ama `main`'de olmayan dallar

İki zincir ve iki bağımsız dal. Zincirde alttakini birleştirmeden üsttekini birleştirmeyin; her PR `main`'e açılır.

| Zincir | Dal | İçerik | Issue |
|---|---|---|---|
| A | `feat/home-audience` | Bireysel/Kurumsal anahtarı, kurumsal ön form, SSS, Yol Boyu Güvence bandı | Refs #25 |
| A | `feat/corporate-quote` | `/kurumsal-teklif` | Refs #41 |
| B | `feat/vehicle-detail` | Araç detay, ek hizmetler, canlı fiyat özeti | Refs #27 |
| B | `feat/booking-summary` | `/rezervasyon` kalem kalem fiyat | Refs #28 |
| B | `feat/payment` | Sahte ödeme, onay, ödeme öncesi giriş koruması | Refs #29 (#35 kısmen) |
| B | `feat/contact-page` | İletişim, bayi arama, Google Map | Refs #43 |
| – | `feat/seo-assets` | favicon, paylaşım görseli, robots, sitemap | (BACKLOG'da yok) |
| – | `chore/a11y-audit` | Kısmi denetim notu ([AUDIT.md](AUDIT.md)) | Refs #47 |

Not: `feat/contact-page` zincir B'nin sonunda ama ödemeye gerçek bir bağımlılığı yok; gerekirse `main`'e yeniden dayandırılabilir.

`feat/products-pages` ve `feat/auth-pages` yerel dalları eskidir; itmeyin.

## 3. Ön yüzün taklit ettikleri (API gelince değişecek)

`USE_MOCKS=1` yoksa bunların hepsi "servis kullanılamıyor" gösterir; örnek veri üretime sızmaz.

| Ne | Dosya | Karşılığı (BE) |
|---|---|---|
| Bayiler, araçlar, ek hizmetler, bayi iletişim bilgisi | `lib/fleet-client.ts`, `mocks/` | `GET /branches`, `/vehicles`, extras (#30) |
| SSS | `lib/faq-client.ts`, `mocks/faq.ts` | `GET /faq` (#42) |
| Rezervasyon oluşturma (uydurma numara) | `lib/reservation-client.ts` | `POST /reservations` (#31) |
| Kurumsal teklif gönderme (her zaman hata) | `lib/quote-client.ts` | `POST /quotes` (#42) |
| Giriş, kayıt, şifre sıfırlama (her zaman hata) | `lib/auth-client.ts` | Auth (#34, #36) |
| Oturum (hep `null`) | `lib/session.ts` | Çerezden oturum (#34) |
| Kurlar | `mocks/fleet.ts` | `ExchangeRate` (Y1, Y2) |

Dikkat: `USE_MOCKS=1` iken `/odeme` sayfasında giriş koruması **kapalı** (auth API olmadığı için akış yoksa görülemezdi). `USE_MOCKS` kapalıyken her zaman açık. Onay sayfası şimdilik rezervasyonu adresten kuruyor; API gelince numaradan okumalı (adresten sahte onay üretilebilir).

## 4. Kalan işler

**FE**
- 8 dalı doğrula, PR'ları aç, sırayla birleştir (§0, §2).
- Denetimin kalanı (#47): Lighthouse, axe, ekran okuyucu, klavye turu ([AUDIT.md](AUDIT.md)).
- Giriş sonrası dönüş yalnızca giriş formunda var; kayıt formu eksik (#35'in kalanı).
- Yasal metin düzeltmesi, en sona: KVKK "işlenen veriler" maddesine para birimi, çerez sayfasındaki "engellerseniz" cümlesine para birimi (#45 sonrası).
- API gelince: MSW/openapi tipleri (#21), ürün/hizmetleri API'ye bağlama (Y5), tüm taklitleri gerçek çağrılarla değiştirme.
- Web testleri (hiç yok).

**BE**
- Prisma: `Product`, `Service`, `ExchangeRate`; `Reservation` üzerinde para birimi + kur anlık görüntüsü.
- Seed verisi (#24): bayiler (adres, koordinat, saat), sınıflar, araçlar, ek hizmetler, SSS, ürün/hizmet, başlangıç kurları.
- `openapi.yaml`.
- Uçlar: araç/müsaitlik (#30), rezervasyon (#31), auth (#34), şifre sıfırlama (#36), hesap silme (#37), teklif/SSS/ürün/hizmet (#42), güvenlik (#48).
- Google Maps anahtarı: referrer kısıtlaması + kota (#44). Anahtar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`'e girer; yoksa İletişim sayfası yalnızca liste gösterir.
- Y1, Y2, Y6 (kur tablosu, `?currency=`, çerez ayarları).

**İKİ**
- Playwright e2e (#46), yayın (#49), ödeme öncesi giriş akışı uçtan uca (#35).

**Kullanıcı (G)**: Y1–Y9 issue'larını açmak, PR'ları açıp birleştirmek, issue'ları kapatmak.

## 5. Karar bekleyenler

1. **Fotoğraflar:** telifsiz stok mu, üretilmiş görsel mi, yer tutucu mu kalsın?
2. **Kur kaynağı:** ADR-15 günlük harici servis diyor; hangisi, anahtar kimde?
3. **Rezervasyonda kur:** rezervasyon anındaki kur mu saklanacak, yoksa TRY mi esas? (Öneri: ikisi de.)
4. **Dağıtım:** web + API + DB nerede yayınlanacak? Şu an yalnızca yerelde.
5. **Kurumsal form ve e-posta:** SPEC e-postanın adreste taşınmasını istiyor (`?eposta=`); bu tarayıcı geçmişine ve günlüklere düşer. Öneri: sessionStorage ile taşımak (SPEC §2.2'de not var).
6. **`USE_MOCKS` iken ödeme girişi:** kapalı kalsın mı (şimdiki), açık mı?
7. **İptal koşulu:** SSS "24 saat öncesine kadar ücretsiz" diyor; SPEC'te kural yok. Kural belirlenip rezervasyon özetine yazılmalı mı?
8. **Toplamı kim hesaplar:** araç sayfasındaki ve özetteki toplam yalnızca gösterim; tahsil edilen tutarı backend hesaplamalı (#31).

## 6. Süreç kuralları (çakışmayı önlemek için)

- Yeni metin yalnızca ilgili özellik dosyasına (`messages/tr/<özellik>.json` ve `en`). Yeni dosya eklenince `i18n/messages.ts` güncellenir.
- Bir dal bir öncekinin üzerine kuruluysa, öncekini main'e birleştirmeden sonrakini birleştirmeyin; PR'ı main'e açın, sırayla birleştirin.
- `Closes #N` yalnızca iş tamamen bitince ve tarayıcıda doğrulanınca; kısmi iş için `Refs #N`.
- Renk kuralı: ana yeşil (`primary`) yalnızca dolgu için; durum göstergesi için `focus` ya da `link` kullanın (koyu temada `primary` yüzeyde 3:1'in altında).
- Bu makinede `USE_MOCKS=1` ile çalışılır; üretim derlemesinde boş bırakılır.
