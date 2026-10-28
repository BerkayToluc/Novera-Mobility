# V2-14 · Web clean code: API altyapısı, kopyalar, token kuralı, hareket kütüphanesi

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** L · **Bağımlı:** V2-08
**Bulgular:** QUALITY M-05, M-07, M-08, M-09, P-02

## Amaç
Panel ekranları yazılmadan önce web'deki tekrarları kaldırmak ve tasarım token kuralını gerçekten zorunlu hale getirmek. Ekranlar görsel olarak değişmez.

## Kapsam
- **API altyapısı:**
  - `api-post.ts` ile `api-request.ts` tek bir istemcide birleşir (başlıklar, çerez iletme, hata çevirisi);
  - `SESSION_COOKIE` yalnızca `session-cookie.ts`'ten gelir;
  - tema ve para birimi çerez yazımı tek bir yardımcıda toplanır.
- **Kopyalar:**
  - dil adları haritası tek yerde;
  - masaüstü (`language-menu`, `currency-menu`) ve mobil (`locale-switcher`, `currency-switcher`) seçicilerin ortak mantığı bir hook ya da yardımcıda;
  - `branch-explorer.tsx` (14 hook) liste, süzgeç ve harita durumu olarak bölünür.
- **Token kuralı:**
  - `eslint.config.mjs:8`'deki regex düzeltilir: `rem` ve `px` içeren her rastgele değer yakalanır.
  - Kural **error** seviyesine çıkar.
  - 77 rastgele değer gözden geçirilir. Izgara şablonları için `globals.css`'e adlı yerleşim token'ları eklenir (ör. `grid-cols-media-text`). Gerçekten tek seferlik olanlar gerekçeli `eslint-disable-next-line` ile kalır.
  - `app/apple-icon.tsx` ve `app/opengraph-image.tsx` ham hex yerine `BRAND_COLORS`'ı kullanır.
- **Hareket:**
  - Navbar menüsündeki `framer-motion` kullanımı CSS geçişlerine döner (`nav-menu.tsx`, `main-nav.tsx`).
  - Kalan iki kullanım (SSS, ana sayfa) yerinde kalır; paket adı `motion` olarak güncellenir ya da gerekçesi PR'a yazılır.
- **Bağımlılıklar:**
  - `@types/node` 22+ olur;
  - `driver-section.tsx:104`'teki kapatılmış `exhaustive-deps` kuralı yeniden değerlendirilir.

## Kapsam dışı
Görsel değişiklik, yeni bileşen.

## Teknik notlar
Dosyalar: `apps/web/lib/api-post.ts:16`, `api-request.ts`, `auth-actions.ts:46-47,113-114`, `preferences-actions.ts:30-31`, `components/profile/preferences-form.tsx:15`, `components/locale-switcher.tsx:12`, `components/branches/branch-explorer.tsx`, `eslint.config.mjs`, `app/globals.css`.

## Kabul kriterleri
- [x] `pnpm lint` token dışı rastgele değeri **hata** sayar (bilerek eklenen bir örnekle gösterilir, sonra silinir).
- [x] Kopya tanımların her biri teke iner.
- [x] Ana sayfa JS yükü `framer-motion` olmadan ölçülür; `next build` çıktısında önce/sonra karşılaştırması PR'da. *(ana sayfa SSS'yi kullandığı için `motion` yüklemeye devam eder; sayfa başına ölçüm PR'da)*
- [x] 375/768/1280 ekran görüntüleri önce/sonra aynı (header, footer, bayiler, ana sayfa). *(piksel karşılaştırması: aynı)*
- [ ] e2e yeşil; QUALITY'de M-05, M-07–M-09 ve P-02 güncel.

## Etiketler
`faz-2` `temel` `refactor` `P1` `web`
