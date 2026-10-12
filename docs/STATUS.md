# Proje durumu

Son güncelleme: 2026-10-11. Bu belge bir anlık görüntüdür; kalıcı kararlar ARCHITECTURE'a, kapsam SPEC'e, iş listesi BACKLOG'a aittir. Çelişki olursa onlar kazanır. Dalların `main`'de olup olmadığını bu belgeye değil `git fetch` sonrası git'e sorun.

**Güncel plan:** SPEC v0.4, ARCHITECTURE v0.2 ve BACKLOG M7 (sıralı iş listesi). Hepsi `main`'de.

Issue numarası = BACKLOG numarası + 9 (ilk 40 satır). GitHub'daki issue başlıkları iş adı değil milestone başlığıdır; işin kendisi issue gövdesindeki satırdır. PR gövdesinde ve commit'te **issue** numarası kullanılır.

## 0. Build ve doğrulama

Bu makinede build için kullanıcı ortam değişkeni gerekir (Y10):

```
SWC_NATIVE_BINDING_CACHE=C:\Users\karad\.swc-cache
```

Bununla `pnpm build`, `pnpm typecheck` ve `pnpm lint` geçiyor. İzinlere dokunulmadı. CI'da ayrıca iç link kontrolü çalışır (`apps/web/scripts/check-links.mjs`, Y31).

**Doğrulama.** 11 Ekim'de 25 sayfa 375, 768 ve 1280 px'te Playwright (sistem Chrome'u) ile ölçüldü: yatay taşma yok, axe (WCAG 2.2 AA, 75 tarama) sıfır ihlal, 11 sayfada Tab ile klavye turu (ilk durak "İçeriğe geç", odak tuzağı ve halkasız öğe yok; ölçüm hesaplanmış stile bakar, gözle inceleme değildir). Uzun sayfaların 375/1280 hâli yalnızca ölçüldü, tek tek gözle incelenmedi. **Hâlâ yapılmadı:** Lighthouse (G yapmayacak; PERFORMANCE.md'deki mobil sayılar geliştirme sunucusundan, geçerli değil; ölçmek isteyen production build + gizli pencere + Kaspersky'nin script eklemesi kapalı kullanmalı), ekran okuyucu turu. Bu yüzden bazı commit'ler `Refs #N` taşır. Ölçümler ve eksikler: [PERFORMANCE.md](PERFORMANCE.md), [AUDIT.md](AUDIT.md).

## 1. `main`'de olanlar

BACKLOG M7'nin frontend işlerinin **tamamı** (Y10–Y44, Y20, Y25–Y32 dahil):

- Palet "Zeytin ve Ege", navbar (açılır menüler, para birimi, tercihler), footer, ana sayfa (kampanya galerisi, kiralama kutusu, kurumsal ön form, iş birlikleri şeridi, Yol Boyu Güvence, mobil uygulama bölümü, rehber kartları, SSS).
- Araçlarımız (model kartları, kategori çipleri, `?arac=` penceresi), SEO temeli, JSON-LD, manifest, `theme-color`, `llms.txt`.
- İletişim (genel merkez, form, şehir filtresi), Yardım merkezi, Rehberler, Ürünler/Hizmetler içeriği, Hakkımızda zaman çizelgesi.
- Hesap: giriş sekmeleri (bireysel/kurumsal), kurumsal hesap sayfaları, ayarlar (dil, tema, para birimi hesaba kaydedilir), Puanlarım, Rezervasyonlarım (yaklaşan/geçmiş).
- Gizlilik politikası, kullanım şartları, çerez onayı (ADR-19), 500 sayfası (ADR-23).
- Kiralama akışı: sonuçlarda **Kirala** aracı 15 dakika tutar (`lib/hold-client.ts`), özette ek hizmet ve fiyat dökümü (`lib/price-client.ts`), geri sayım, "Süre doldu" ve "az önce kiralandı" ekranları. Araç detay sayfası yok.
- Analytics (`components/analytics.tsx`): yalnızca onayla ve yalnızca `ANALYTICS_SCRIPT_URL` + `ANALYTICS_WEBSITE_ID` doluysa sayfaya yazılır. Güvenlik başlıkları ve nonce'lu CSP (`proxy.ts`, `lib/csp.ts`, `next.config.ts`).
- Testler: Vitest birim testleri (`apps/web/tests`, `pnpm test`) ve Playwright e2e (`apps/web/e2e`, 375 + 1280 px; `pnpm build` sonrası `pnpm --filter @novera/web test:e2e`). CI ikisini de, ayrıca iç link kontrolünü çalıştırır.
- Backend tarafında şema v2 ve `docs/api/openapi.yaml` v0.1 sözleşmesi (araç tutma `POST /holds`, `POST /reservations/price`, `/me/points`, `/me/preferences` vb. dahil).

## 2. Bekleyen dallar

Tablet (768 px) düzeni ve denetim düzeltmeleri, birbirinin üzerine kurulu uzun bir zincir (6–9 ve 11, `feat/navbar-pill` ile başlar ve birbirine kurulu; 5 ve 10 numaralı belge dalları ayrıdır); G'ye "Create a merge commit" ile **bu sırayla** birleştirmek kalır (`git fetch` sonrası `git log origin/main..origin/<dal>` ile kontrol edin):

1. `fix/tablet-layout`: Yol Boyu Güvence bandı (768'de ortada çizgi, adımlar sağlı sollu), rehber ve araç listeleri 2 sütun (araç kartı md–xl arası dikey), footer, galeri denetimleri, Yardım ve Hakkımızda ayarları.
2. `fix/booking-tablet`: özet ve ödemede xl altında ekrana yapışan toplam şeridi, hizalanan bağlantı düğmeleri (`size="inline"`), ortalanmış onay sayfası, altı çizili "Şifremi unuttum".
3. `fix/visual-tour`: İletişim 768'de yan yana, Ürünler'de öksüz kart yok, kaydırılabilir profil sekmeleri, Hakkımızda sayaçlarında axe düzeltmesi, footer bağlantı genişliği.
4. `fix/quote-centred`: Kurumsal teklif sayfası 1280 px'te tek sütunda ortalı.
5. `docs/spec-v05`: SPEC v0.5 (navbar, Bayilerimiz, filo ana sayfada, sürücü uygunluğu önerisi §2.10), ADR-22 ve BACKLOG Y49–Y52. Kod değil, ama aşağıdaki üç dalın dayanağı.
6. `feat/navbar-pill`: yüzen hap navbar, bayraklı dil menüsü, hesap simgesi, tema navbardan çıktı, Hizmetler düz link (Y49).
7. `feat/branches-page`: `/bayilerimiz`, bayi bölümü İletişim'den taşındı (Y50).
8. `feat/fleet-on-home`: filo ana sayfada, kategori başına bir liste, `/araclarimiz` kalktı (Y51).
9. `feat/driver-eligibility`: ödemede sürücü bilgileri ve simüle ehliyet doğrulama, sınıf × ehliyet ülkesi kural tablosu (örnek değerler, `lib/driver-rules.ts`), hiçbir veri saklanmaz (Y52, SPEC §2.10).
10. `docs/spec-v06`: SPEC v0.6 (ana sayfa rötuşları), BACKLOG Y53. Belge dalı, ayrı.
11. Ana sayfa rötuşları (Y53, SPEC v0.6), birbirine kurulu: `feat/home-form-branches` (kurumsal süre 1/2/3 ay, bayi satırında çalışma durumu), `feat/home-fleet-cards` (tek sütun kart, fiyat bloğu), `feat/home-strip-guarantee` (şerit hover/odakta akar, güvence çizgisi akan iz), `feat/home-app-guides` (mağaza işaretleri, oklu rehber kaydırıcı), `feat/home-faq` (konu sekmeli SSS, `framer-motion` yeni bağımlılık).

Hepsi `Refs #47` taşır (denetim işi açık). Yeni iş için `main`'den dallanılır.

## 3. Ön yüzün taklit ettikleri (API gelince değişecek)

`USE_MOCKS=1` yoksa bunların hepsi "servis kullanılamıyor" gösterir; örnek veri üretime sızmaz.

| Ne | Dosya | Karşılığı (BE) |
|---|---|---|
| Bayiler, araçlar, ek hizmetler, bayi iletişim bilgisi | `lib/fleet-client.ts`, `mocks/` | `GET /branches`, `/vehicles`, `/extras` |
| SSS (konu alanıyla) | `lib/faq-client.ts`, `mocks/faq.ts` | `GET /faq` (**`topic` alanı gerekiyor**) |
| Rezervasyon oluşturma (uydurma numara) | `lib/reservation-client.ts` | `POST /reservations` |
| Kurumsal teklif ve iletişim formu | `lib/quote-actions.ts`, `lib/contact-actions.ts` | `POST /quotes`, `POST /contact` |
| Giriş (sahte oturum çerezi, yalnızca `USE_MOCKS=1`), çıkış | `lib/auth-actions.ts`, `lib/session.ts`, `mocks/accounts.ts` | `/auth/login`, `/auth/logout`, `/me` |
| Kayıt, şifre sıfırlama (her zaman hata) | `lib/auth-client.ts` | `/auth/register`, `/auth/forgot-password` |
| Tercihleri kaydetme (sahte çerez) | `lib/preferences-actions.ts` | `PATCH /me` tercihleri (Y47) |
| Puanlar, rezervasyonlarım, teklif taleplerim | `lib/account-client.ts`, `mocks/reservations.ts`, `mocks/quotes.ts` | `/me/points`, `/me/reservations`, `GET /me/quotes` (**sözleşmede yok**) |
| Kurlar | `mocks/fleet.ts` | `GET /rates` |

Dikkat: `USE_MOCKS=1` iken `/odeme` sayfasında giriş koruması **kapalı**; `USE_MOCKS` kapalıyken açık. Onay sayfası rezervasyonu hâlâ adresten kuruyor; API gelince numaradan okumalı.

## 4. Kalan işler

**FE**
- Google Maps haritası CSP altında ve gerçek anahtarla denenmedi (CSP Google adreslerine izin veriyor); anahtar gelince bir kez bakılmalı.
- Denetim (#47): ekran okuyucu. Lighthouse'u G yapmayacak, PERFORMANCE.md'deki sayılar geçersiz kalır. 768 px turu, axe ve klavye turu yapıldı (§0).
- Fotoğraflar (SPEC §6, §10): G sağlayacak; yerleştirme, WebP/AVIF sıkıştırma (bu makinede `cwebp`/`magick` yok, bir yol gerekir), `next/image` önceliği, sonra production LCP yeniden ölçümü.
- API gelince: tüm taklitleri gerçek çağrılarla değiştirmek, openapi tipleri; e2e'ye SPEC §8 adım 4 (yeni rezervasyon Rezervasyonlarım'da) eklemek.
- Bileşen testleri yok (yalnızca birim ve e2e).

**BE**
- Sözleşmedeki uçların gerçeklenmesi. Seed verisi `main`'de (#160); SPEC §4.1'e (14 şehirde 15 bayi, 15 model) uygunluğu bu belge yazılırken denetlenmedi.
- Sözleşmeye eklenecekler: `topic` (SSS), `GET /me/quotes`, rezervasyon cevabında `pointsEarned`.
- Y33–Y35, Y45–Y48 (BACKLOG).
- Google Maps anahtarı: referrer kısıtlaması + kota; `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Canlı ortam değişkenleri: `NEXT_PUBLIC_SITE_URL` (yoksa sitemap ve JSON-LD adresleri localhost olur) ve analytics aracını kurup `ANALYTICS_SCRIPT_URL`, `ANALYTICS_WEBSITE_ID` değerlerini yazmak (Umami öngörüldü, ADR-19).

**Kullanıcı (G)**
- Fotoğrafları sağlamak (liste ve bütçeler SPEC §6).
- Arkadaşa iletmek: yukarıdaki sözleşme eklemeleri.

## 5. Karar bekleyenler

Açık kararlar SPEC §10'da (fotoğraflar, analytics aracı, yayın ortamı). Diğerleri:

1. **Kur kaynağı:** ADR-15 günlük harici servis diyor; hangisi, anahtar kimde?
2. **Rezervasyonda kur:** anlık kur mu saklanacak, TRY mi esas? (Öneri: ikisi de.)
3. **Kurumsal form e-postası:** ön form e-postayı adreste taşıyor (`?eposta=`); tarayıcı geçmişine düşer.
4. **`USE_MOCKS` iken ödeme girişi:** kapalı kalsın mı (şimdiki), açık mı?
5. ~~**İptal koşulu**~~ Karar verildi: rezervasyon özetinde yazıyor (`4a8f641`, `main`'de).
6. **Kurumsal sekmesi hesap açma:** kurumsal hesabı Novera açıyor (öneri); onay bekliyor.

## 6. Süreç kuralları

- Yeni metin yalnızca ilgili özellik dosyasına (`messages/tr/<özellik>.json` ve `en`). Yeni dosya eklenince `i18n/messages.ts` güncellenir.
- İşler BACKLOG M7 sırasıyla yapılır; değişecekse önce G'ye sorulur.
- Dallar `main`'den açılır. G onaylarsa art arda zincir kurulabilir (10 Ekim'de beş, sonra on dal böyle yapıldı); G hepsini sırayla "Create a merge commit" ile birleştirir, squash yapmaz.
- Push, PR ve birleştirme G'nindir.
- `Closes #N` yalnızca iş tamamen bitince ve tarayıcıda doğrulanınca; kısmi iş için `Refs #N`.
- Renk kuralı: ana yeşil (`primary`) yalnızca dolgu için; durum göstergesi için `focus` ya da `link` kullanın.
- Bu makinede `USE_MOCKS=1` ile çalışılır; üretim derlemesinde boş bırakılır.
