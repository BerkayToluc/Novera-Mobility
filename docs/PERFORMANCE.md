# Hız ölçümü (BACKLOG Y32)

Hedef (SPEC §9, mobil): LCP < 2,5 sn · INP < 200 ms · CLS < 0,1.

## Ne ölçüldü, nasıl

11 Ekim 2026, üretim derlemesi (`next build` + `next start`, `USE_MOCKS=1`), Claude uygulamasındaki tarayıcı paneli, **kısıtlama yok** (yerel ağ ve işlemci). Bu bir Lighthouse raporu değildir: bu makinede Lighthouse indirilemedi (ağ yok). Sayılar sayfanın kendi `PerformanceObserver` ölçümleridir.

| Sayfa | LCP | CLS | Uzun görev (>50 ms) | Not |
|---|---|---|---|---|
| Ana sayfa (`/`) | ≈1,8 sn (başlık metni) | 0 | 0 | 30 istek, ≈410 KB (JS ≈338 KB), TTFB ≈470 ms |
| Araçlarımız, İletişim, Hakkımızda, Rehberler, Yardım, `/en` | ölçülemedi (sayfa gizli çerçevede) | 0 | 0 | 15–18 istek |

## Okuma

- CLS her sayfada 0: görsel yer tutucular SVG ve boyutlu, yazı tipi `font-display: swap` ile değişirken kayma yok.
- LCP elemanı bir başlık metni: sayfada raster görsel yok, bu yüzden "ilk görsel öncelikli" kuralı (SPEC §2.2) şimdilik uygulanacak bir görsele sahip değil. Gerçek fotoğraflar gelince ilki `priority` ile yüklenmeli.
- Uzun görev yok; INP için güvenilir bir ölçüm yapılmadı (gerçek kullanıcı etkileşimi gerekir).
- Ana sayfanın TTFB'si ≈470 ms: sayfa her istekte sunucuda üretiliyor (tema ve para birimi çerezleri, ADR-13/15). Bilinen ödünleşim.

## Yapılmadı / G'nin yapması gereken

- Chrome'da **Lighthouse (mobil, Slow 4G)** ana sayfa, Araçlarımız ve İletişim için çalıştırılmalı; rapor PR'a eklenmeli. Hedefin altında çıkan bir sayı bu dosyaya yazılıp düzeltilmeli.
- Gerçek fotoğraflar eklenince LCP yeniden ölçülmeli.
