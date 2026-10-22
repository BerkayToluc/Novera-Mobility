# V2-21 · Performans: production Lighthouse, LCP ve fotoğraflar

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-15
**Bulgular:** QUALITY P-03, P-04

## Amaç
Site hızı hiçbir zaman production build'de ölçülmedi. SPEC §5'teki Core Web Vitals hedeflerine ulaşıldığını kanıtlamak ve eksik fotoğrafları tamamlamak.

## Kapsam
- **Fotoğraflar:**
  - Eksik 4 modelin (volkswagen-golf, hyundai-tucson, volkswagen-id4, audi-a6) fotoğrafı tamamlanır.
  - G'nin sağladığı `carPhotos/` klasöründen seçilir; seçim G'ye sorulur.
  - WebP/AVIF'e sıkıştırılır, model başına en çok ~120 KB.
  - Kaynaklar `docs/PHOTO-CREDITS.md`'ye yazılır.
- **LCP:** ilk görünen araç ve galeri görseli `preload` alır (Next 16), `sizes` doğru verilir.
- **Ölçüm:**
  - production build (`pnpm build && pnpm start` ya da Vercel önizlemesi), gizli pencere;
  - mobil Lighthouse: ana sayfa, `/araclar`, `/urunler/akilli-kurumsal-filo`, `/bayilerimiz`;
  - her sayfa üç ölçümün ortancası.
- **Rapor:** `docs/PERFORMANCE.md` (yeni sürüm). Arşivdekinin yerine geçer; tarihi ve yöntemi yazar.
- Hedefin altında kalan ölçüm için düzeltme yapılır ya da nedeni ve sonraki adım yazılır.

## Teknik notlar
- Dosyalar: `apps/web/components/vehicle/vehicle-image.tsx`, `public/`, `components/home/*` (galeri).
- Bu makinede görsel dönüştürme aracı yoksa sharp ile küçük bir betik (`apps/web/scripts/`) kullanılır.
- `carPhotos/` repoya girmez.

## Kabul kriterleri
- [ ] 15 modelin hepsinde fotoğraf var; kaynaklar belgede.
- [ ] Mobil Lighthouse ortancası: LCP < 2,5 sn, CLS < 0,1. INP için laboratuvar TBT < 200 ms ve not.
- [ ] PERFORMANCE.md güncel, PR'da özet tablo.
- [ ] QUALITY'de P-03 ve P-04 güncel.

## Etiketler
`faz-2` `temel` `P1` `web`
