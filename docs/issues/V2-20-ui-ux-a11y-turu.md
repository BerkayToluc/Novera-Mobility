# V2-20 · UI/UX, responsive ve erişilebilirlik turu

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-15, V2-16
**Bulgular:** QUALITY U-05 (ve turda bulunacaklar)

## Amaç
v1 ölçümle denetlendi (axe, taşma, klavye) ama sayfa sayfa tasarım eleştirisi ve ekran okuyucu turu hiç yapılmadı. Panel ve Filom eklenmeden önce müşteri yüzünün temiz olduğundan emin olmak.

## Kapsam
- **Tur listesi:** tüm herkese açık sayfalar, kiralama akışı, hesap sayfaları; iki dil; açık ve koyu tema. Liste PR'da tablo olarak verilir.
- **Her sayfada:**
  - 320, 375, 768, 1024 ve 1280 px'te görsel kontrol (taşma, hizalama, boşluk ritmi);
  - QUALITY §3.4 kontrol listesi;
  - DESIGN.md kurallarına uyum: tek birincil düğme, token, tutarlı bileşen;
  - `impeccable` (critique/audit) ve `web-design-guidelines` becerileriyle eleştiri.
- **Klavye turu:** odak sırası, görünür odak, tuzak yok, Esc davranışları.
- **Ekran okuyucu turu (NVDA + Chrome):** üç akış: kiralama (ana sayfa → onay), kurumsal teklif, giriş + Rezervasyonlarım. Notlar PR'a yazılır.
- **Bulguların işlenmesi:**
  - Küçük düzeltmeler bu PR'da yapılır.
  - Büyükler QUALITY.md'ye yeni U-xx satırı olarak girer ve G'ye issue önerisi olarak gider.
  - **Büyük görsel değişiklik önce G'ye sorulur.**

## Teknik notlar
- `apps/web/e2e/responsive.spec.ts` 1024 ve 1280'i de kapsayacak ve yeni sayfaları içerecek şekilde genişletilir.
- Tasarım kaynakları: DESIGN.md, `app/globals.css`.

## Kabul kriterleri
- [x] Tur tablosu PR'da: sayfa × genişlik × durum. (Otomatik tur: 20 sayfa × 320/375/768/1024/1280 × açık/koyu × TR/EN.)
- [ ] Ekran okuyucu notları PR'da; engelleyici sorun kalmadı.
- [x] Bulunanların her biri ya düzeltildi ya QUALITY'de kayıtlı. (Otomatik turda gerçek bulgu çıkmadı; 365 dokunma hedefi uyarısı elle incelendi, hepsi yanlış alarm: etiketle büyüyen onay kutusu, kartı kaplayan düğme, gizli yerel select, 43,x px yuvarlama.)
- [ ] 375 ve 1280 ekran görüntüleri (önce/sonra) değişen sayfalar için.
- [ ] QUALITY'de U-05 güncel.

## Etiketler
`faz-2` `temel` `P1` `web`
