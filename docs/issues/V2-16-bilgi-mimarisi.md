# V2-16 · Bilgi mimarisi ve küçük UX hataları

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** S · **Bağımlı:** V2-14
**Bulgular:** QUALITY U-01, U-02, U-03, U-04, U-06

## Amaç
Sayfa hiyerarşisindeki boşlukları ve küçük ama görünür hataları kapatmak.

## Kapsam
- **Kurumsal teklif erişimi:** ana kurumsal dönüşüm sayfası `/kurumsal-teklif` menüye girer.
  - Footer'ın "Keşfet" sütununa "Kurumsal teklif" eklenir.
  - Navbar'daki Ürünler açılır menüsünün altına "Teklif alın" bağlantısı eklenir.
  - Navbar'a yeni bir üst düzey öğe **eklenmez**.
  - Önce G'ye ekran görüntüsüyle önerilir.
- **KVKK ve gizlilik politikası:** `/kvkk` ve `/gizlilik-politikasi` ayrı kalır.
  - Her birinin başına iki belgenin farkını anlatan bir cümle ve diğerine bağlantı eklenir.
  - Metin TR/EN olarak `legal.json`'a girer.
- **Rezervasyon kartı fotoğrafı:** kartlar modelin fotoğrafını gösterir (`reservation-list.tsx:86`'daki sabit `imageUrl={null}` kalkar). Gerekirse rezervasyon cevabındaki model bilgisine `imageUrl` eklenir.
- **Eski yorum:** hizmetler sayfasındaki yorum düzeltilir (`hizmetler/page.tsx:24`).
- **Web manifest:**
  - 192 ve 512 px PNG ikon, maskable ikon;
  - `id`, `scope`;
  - ikonlar `BRAND_COLORS`'tan üretilir (`app/icon-*.tsx` ya da `public/`).

## Teknik notlar
Dosyalar: `apps/web/components/layout/nav-items.ts`, `site-footer.tsx`, `components/layout/nav-menu.tsx`, `app/[locale]/kvkk`, `gizlilik-politikasi`, `components/profile/reservation-list.tsx`, `app/manifest.ts`, `lib/public-pages.ts` (sitemap; kurumsal teklif zaten varsa dokunulmaz), `scripts/check-links.mjs`.

## Kabul kriterleri
- [ ] G menü önerisini onayladı (issue yorumu). *(bekliyor: PR'daki ekran görüntülerine bakılacak)*
- [x] Footer ve Ürünler menüsünden `/kurumsal-teklif`'e gidilir (e2e).
- [x] İki gizlilik sayfası birbirine bağlantı verir.
- [x] Rezervasyon kartlarında model fotoğrafı görünür (e2e; mock'ta da).
- [x] Manifest'te 192/512/maskable ikon var; Chrome DevTools "Application > Manifest" uyarısız (ekran görüntüsü).
- [x] 375/1280 ekran görüntüleri; QUALITY'de U-01–U-04 ve U-06 güncel.

## Etiketler
`faz-2` `temel` `P1` `web`
