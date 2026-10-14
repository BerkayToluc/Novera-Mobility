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

G'nin kuralı (12 Ekim): **her sayfa ya da bileşen grubu bir dal, bir PR.** Bunlar birbirinin üzerine kurulu bir zincirdir; `git fetch` sonrası `git log origin/main..origin/<dal>` ile kontrol edin, G "Create a merge commit" ile bu sırayla birleştirir:

1. `fix/tablet-layout` → `fix/booking-tablet` → `fix/visual-tour` → `fix/quote-centred`: 768 px turu ve denetim düzeltmeleri (Güvence bandı, rehber ve araç listeleri, footer, galeri, sabit toplam şeridi, İletişim yan yana, profil sekmeleri, axe, kurumsal teklif ortalı).
2. `feat/navbar-pill`: **Navbar** (Y49): yüzen hap, bayraklı dil menüsü, hesap simgesi, tema navbardan çıktı, Hizmetler düz link.
3. `feat/branches-page`: **Bayilerimiz sayfası** (Y50): `/bayilerimiz`, bayi bölümü İletişim'den taşındı.
4. `feat/home-page`: **Araç Kirala (ana sayfa)** (Y51, Y53): filo ana sayfada ve `/araclarimiz` kalktı; kurumsal süre 1/2/3 ay; bayi satırında çalışma durumu; tek sütun araç kartı ve fiyat bloğu; şerit hover/odakta akar; güvence çizgisi akan iz; mağaza işaretleri; oklu rehber kaydırıcı; konu sekmeli SSS (`framer-motion`); Konumumu kullan; Nasıl çalışır?.
5. `feat/payment-page`: **Ödeme sayfası** (Y52): sürücü bilgileri ve simüle ehliyet doğrulama (sınıf × ehliyet ülkesi kural tablosu, örnek değerler, hiçbir veri saklanmaz, SPEC §2.10) ve kampanya kodu.
6. `feat/branches-extras`: **Bayilerimiz'in devamı** (Y50): arama kutulu şehir listesi (`feat/branches-page`'in son commit'ini içerir), kartta açık/kapalı, Buradan kirala, Bana en yakın bayiler, bayi türü çipleri, ortalanmış başlık.
7. `feat/footer-simple`: **Footer** (Y54): Framer Simple Footer'ın ↗ hover okları, bloklarda yerine oturma hareketi, xl altında linklerin markadan önce gelmesi.
8. `feat/navbar-hover`: **Navbar hover** (Y55): linklerde harf yuvarlama (SplitTextHover), Ürünler menüsü hover'la açılır ve kayan vurgu (Pill Dropdown Nav).
9. `feat/home-v3`: **Ana sayfa v3** (Y56): galeri okları kartın kenarlarında, iş birlikleri Logo 3D Carousel (kendiliğinden akar, hover/odakta durur), güvence bandı StepProgress, rehber kartı hover, SSS Framer satırları. Zincirde `feat/navbar-hover`'ın üzerine kuruludur.
10. `feat/footer-v3`: **Footer v3** (Y57): wavy link hover, sosyal ikonlar (bağlantı değil), 3x göz, boşluklar.
11. `feat/smart-contact-link`: **E-posta balonu** (Y58): gönder / kopyala.
12. `feat/about-countup`: **Hakkımızda** (Y59): Sürdürülebilirlik rakamları görününce sayar.
13. `feat/products-v2`: **Ürünler** (Y60): ton zeminli kartlar ve çizimler, yeni ürün detayı.
14. `feat/results-filters-points`: **Uygun Araçlar** (Y61): Filtrele paneli ve Puanla öde.
15. `feat/summary-pricing`: **Rezervasyon özeti** (Y62): ara toplam, kampanya, puan, KDV; kampanya kodu ödemeden özete taşındı.
16. `feat/points-five`: **1 puan = ₺5** (Y64): değer sabiti, anahtar, özet satırı, Puanlarım ve SSS metinleri, testler.
17. `feat/driver-18`: **Sürücü kuralı 18 yaş + geçerli ehliyet** (Y65): sınıf ve ülke yıl tablosu kalktı; ABD için uluslararası belge kaldı.
18. `feat/results-cards-v2`: **Sonuç kartları** (Y66): toplam fiyat önce, 100 km tüketim, liste/ızgara görünümü, tek araç çubuğu.
19. `feat/contact-help-card`: **İletişim** (Y67): "Size en yakın bayi" yerine Yardım merkezi kartı.
20. `feat/profile-shell`: **Profil kabuğu** (Y68): karşılama, puan çipi, ikonlu yan menü, sıradaki seyahat, hızlı işlemler.
21. `feat/profile-trips`: **Rezervasyonlarım** (Y69): durum çipleri, bayi adı ve saat, yol tarifi, bayiyi ara, simüle iptal.
22. `feat/profile-points-settings`: **Puanlarım ve Ayarlar** (Y70): ₺ karşılığı ve harcama bağlantısı; bildirim, şifre, oturum bölümleri (simüle).
23. `feat/services-v2`: **Hizmetler** (Y72): kart ızgarası, rakamlar, nasıl işler, paket etiketleri, ürün tablosu, acil durum bandı.
24. `feat/phone-contact-link`: **Telefon balonu** (Y73): gönder/kopyala, iletişim ve bayi kartlarında.
25. `feat/quote-product-chip`: **Kurumsal teklif** (Y74): seçili ürün şeridi.
26. `test/e2e-expect-timeout`: **e2e** (Y75): beklenen koşullar için 10 sn.

Belge dalları ayrı: `docs/spec-v05` (SPEC v0.5, ADR-22, BACKLOG Y49–Y52), `docs/spec-v06` (SPEC v0.6, BACKLOG Y53) `docs/spec-v07` (SPEC v0.7, BACKLOG Y54–Y63; `docs/spec-v06`'nın üzerine kuruludur) `docs/spec-v08` (SPEC v0.8, BACKLOG Y64–Y71; `docs/spec-v07`'nin üzerine kuruludur) ve `docs/spec-v09` (SPEC v0.9, BACKLOG Y72–Y75; `docs/spec-v08`'in üzerine kuruludur), bu belgenin dalı `docs/status-visual-tour`.

**Eski dallar artık gereksiz:** `feat/fleet-on-home`, `feat/driver-eligibility`, `feat/home-form-branches`, `feat/home-fleet-cards`, `feat/home-strip-guarantee`, `feat/home-app-guides` ve `feat/home-faq` yukarıdaki sayfa dallarının parçalarıydı (aynı commit'ler 4 ve 5'te). Uzağa itildiyse silinebilir, birleştirilmemeli.

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
