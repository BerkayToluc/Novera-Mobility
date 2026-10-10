# Proje durumu

Son güncelleme: 2026-10-10. Bu belge bir anlık görüntüdür; kalıcı kararlar ARCHITECTURE'a, kapsam SPEC'e, iş listesi BACKLOG'a aittir. Çelişki olursa onlar kazanır. Dalların `main`'de olup olmadığını bu belgeye değil `git fetch` sonrası git'e sorun.

**Güncel plan:** SPEC v0.3, ARCHITECTURE v0.2 ve BACKLOG M7 (sıralı iş listesi, G onayladı). Bunlar `docs/site-update` dalında; o PR birleşene kadar plan oradadır.

Issue numarası = BACKLOG numarası + 9 (ilk 40 satır). GitHub'daki issue başlıkları iş adı değil milestone başlığıdır (ör. #27 "## M2 · Kiralama akışı"); işin kendisi issue gövdesindeki satırdır. PR gövdesinde ve commit'te **issue** numarası kullanılır.

## 0. Build ve doğrulama

**Build sorunu çözüldü (10 Ekim).** `pnpm build` ve `next typegen` bu makinede `ERR_SWC_NATIVE_CACHE` veriyordu. Sebep: SWC'nin yerel önbelleği varsayılan olarak `%LOCALAPPDATA%\swc` altında. `C:\Users\karad\AppData` klasöründe bir AppContainer SID'ine tam yetki tanımlı ve SWC bu izni güvensiz bulup reddediyor. Proje içindeki bir önbellek yolu da Windows'un 260 karakterlik yol sınırını aşıyor. Çözüm, kısa bir klasörü gösteren kullanıcı ortam değişkeni:

```
SWC_NATIVE_BINDING_CACHE=C:\Users\karad\.swc-cache
```

Bu ayarla `pnpm build`, `pnpm typecheck` ve `pnpm lint` geçiyor. İzinlere dokunulmadı.

**Doğrulama borcu sürüyor.** 9 Ekim'de bekleyen 8 daldan 6'sı (#71–#75) `main`'e girdi ve `main` build alıyor, ama hiçbiri tarayıcıda 375/768/1280'de denenmedi. Commit'ler bu yüzden `Refs #N` taşıyor. Sıradaki iş BACKLOG Y11.

## 1. `main`'de olanlar

- İskelet, tasarım token'ları, i18n, tema, header/footer/mobil menü.
- Ürünler, Hizmetler, Hakkımızda, giriş/kayıt sayfaları.
- Next proxy (`/api/*` → `API_URL`), API kararları (ADR-14…17).
- Mesajların özellik başına bölünmesi, yasal sayfalar + 404, profil sayfaları, saat dilimi (`Europe/Istanbul`), para birimi seçici (TRY/EUR/USD), Araçlarımız, arama formu + `/araclar` sonuçları, README düzeltmeleri, CI'da typecheck.
- 10 Ekim'e kadar eklenenler (tarayıcıda doğrulanmadı): araç detay + ek hizmetler (SPEC v0.3'te kalkıyor, BACKLOG Y20), `/rezervasyon` özeti, sahte ödeme + onay, İletişim (bayi arama, liste, Google Map), favicon/paylaşım görseli/robots/sitemap, kısmi erişilebilirlik denetimi ([AUDIT.md](AUDIT.md)).

## 2. Push'lu ama `main`'de olmayan dallar

| Zincir | Dal | İçerik | Issue |
|---|---|---|---|
| A | `feat/home-audience` | Bireysel/Kurumsal anahtarı, kurumsal ön form, SSS, Yol Boyu Güvence bandı | Refs #25 |
| A | `feat/corporate-quote` | `/kurumsal-teklif` | Refs #41 |

Önce `home-audience`, sonra `corporate-quote`; ikisinin PR'ı da `main`'e açılır. Ana sayfa SPEC v0.3'te yeniden düzenleniyor (BACKLOG Y15–Y18); bu iki dal o işlerin zeminidir.

Push edilmemiş belge dalları: `docs/status-update` (bu belge), `docs/site-update` (SPEC/ARCHITECTURE/BACKLOG).

`feat/products-pages` ve `feat/auth-pages` yerel dalları eskidir; itmeyin.

## 3. Ön yüzün taklit ettikleri (API gelince değişecek)

`USE_MOCKS=1` yoksa bunların hepsi "servis kullanılamıyor" gösterir; örnek veri üretime sızmaz.

| Ne | Dosya | Karşılığı (BE) |
|---|---|---|
| Bayiler, araçlar, ek hizmetler, bayi iletişim bilgisi | `lib/fleet-client.ts`, `mocks/` | `GET /branches`, `/vehicles`, extras (#30) |
| SSS | `lib/faq-client.ts`, `mocks/faq.ts` (A zincirinde) | `GET /faq` (#42) |
| Rezervasyon oluşturma (uydurma numara) | `lib/reservation-client.ts` | `POST /reservations` (#31) |
| Kurumsal teklif gönderme (her zaman hata) | `lib/quote-client.ts` (A zincirinde) | `POST /quotes` (#42) |
| Giriş, kayıt, şifre sıfırlama (her zaman hata) | `lib/auth-client.ts` | Auth (#34, #36) |
| Oturum (hep `null`) | `lib/session.ts` | Çerezden oturum (#34) |
| Kurlar | `mocks/fleet.ts` | `ExchangeRate` (Y1, Y2) |

Dikkat: `USE_MOCKS=1` iken `/odeme` sayfasında giriş koruması **kapalı** (auth API olmadığı için akış yoksa görülemezdi). `USE_MOCKS` kapalıyken her zaman açık. Onay sayfası şimdilik rezervasyonu adresten kuruyor; API gelince numaradan okumalı (adresten sahte onay üretilebilir).

## 4. Kalan işler

**FE**
- BACKLOG M7, **sırasıyla** (Y10–Y32). Sıra G'nin onayıyla belirlendi; değişecekse önce G'ye sorulur.
- Denetimin kalanı (#47): Lighthouse, axe, ekran okuyucu, klavye turu ([AUDIT.md](AUDIT.md)).
- Giriş sonrası dönüş yalnızca giriş formunda var; kayıt formu eksik (#35'in kalanı).
- Yasal metin düzeltmesi: KVKK "işlenen veriler" maddesine para birimi, çerez sayfasındaki "engellerseniz" cümlesine para birimi (#45 sonrası; Y25 ile birlikte yapılabilir).
- API gelince: MSW/openapi tipleri (#21), ürün/hizmetleri API'ye bağlama (Y5), tüm taklitleri gerçek çağrılarla değiştirme.
- Web testleri (hiç yok).

**BE**
- `openapi.yaml` (#15): ARCHITECTURE "Backend ile netleşecekler" tablosundaki açık konular burada cevaplanır.
- Prisma: `Product`, `Service`, `ExchangeRate`; `Reservation` üzerinde para birimi + kur anlık görüntüsü.
- Seed verisi (#24): SPEC §4.1 rakamları (14 şehirde 15 bayi, 15 model), sınıflar, ek hizmetler, SSS, ürün/hizmet (SPEC Ek A), başlangıç kurları.
- Uçlar: araç/müsaitlik (#30), rezervasyon (#31), auth (#34), şifre sıfırlama (#36), hesap silme (#37), teklif/SSS/ürün/hizmet (#42), güvenlik (#48), BACKLOG Y33–Y35 (model/araç ayrımı, `POST /contact`, `POST /quotes` alanları).
- Google Maps anahtarı: referrer kısıtlaması + kota (#44). Anahtar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`'e girer; yoksa İletişim sayfası yalnızca liste gösterir.
- Y1, Y2, Y6 (kur tablosu, `?currency=`, çerez ayarları).

**İKİ**
- Playwright e2e (#46), yayın (#49), ödeme öncesi giriş akışı uçtan uca (#35).

**Kullanıcı (G)**
- `SWC_NATIVE_BINDING_CACHE` ortam değişkenini kalıcı yapmak (Y10).
- İki belge dalını push edip PR açmak; A zincirinin PR'larını açmak.
- #27'yi (araç detay) "not planned" olarak kapatmak.
- Y1–Y35 için issue açmak ve numaralarını BACKLOG'a yazdırmak.
- Simple Footer ekran görüntüsünü göndermek (Y19).

## 5. Karar bekleyenler

Site güncellemesiyle ilgili açık kararlar SPEC §10'da (kurumsal kutu tasarımı, footer, fotoğraflar, analytics aracı, kampanya içeriği, yayın ortamı). Backend sözleşmesindeki açık konular ARCHITECTURE "Backend ile netleşecekler" tablosunda. Bunların dışında kalanlar:

1. **Kur kaynağı:** ADR-15 günlük harici servis diyor; hangisi, anahtar kimde?
2. **Rezervasyonda kur:** rezervasyon anındaki kur mu saklanacak, yoksa TRY mi esas? (Öneri: ikisi de.)
3. **Kurumsal form ve e-posta:** mevcut ön form e-postayı adreste taşıyor (`?eposta=`); bu tarayıcı geçmişine ve günlüklere düşer. Kurumsal akış Y16'da yeniden tasarlanırken çözülecek.
4. **`USE_MOCKS` iken ödeme girişi:** kapalı kalsın mı (şimdiki), açık mı?
5. **İptal koşulu:** SSS "24 saat öncesine kadar ücretsiz" diyor; SPEC'te kural yok. Kural belirlenip rezervasyon özetine yazılmalı mı?

## 6. Süreç kuralları (çakışmayı önlemek için)

- Yeni metin yalnızca ilgili özellik dosyasına (`messages/tr/<özellik>.json` ve `en`). Yeni dosya eklenince `i18n/messages.ts` güncellenir.
- İşler BACKLOG M7 sırasıyla yapılır; bir iş, bağımlı olduğu işler `main`'e girdikten sonra `main`'den dallanır. Zincir kurulmaz.
- `Closes #N` yalnızca iş tamamen bitince ve tarayıcıda doğrulanınca; kısmi iş için `Refs #N`.
- Renk kuralı: ana yeşil (`primary`) yalnızca dolgu için; durum göstergesi için `focus` ya da `link` kullanın (koyu temada `primary` yüzeyde 3:1'in altında).
- Bu makinede `USE_MOCKS=1` ile çalışılır; üretim derlemesinde boş bırakılır.
- Bu makinede build için `SWC_NATIVE_BINDING_CACHE` tanımlı olmalı (§0).
