> **Arşiv (v1, 22 Ekim 2026'da taşındı).** Bu belge artık güncellenmez; yalnızca referanstır. Güncel belgeler için [docs/README.md](../../README.md). Göreli bağlantılar taşınmadan önceki konuma göre yazılmıştır.

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

## Lighthouse, 11 Ekim 2026 (G, Chrome DevTools, mobil)

| Sayfa | Performans | Erişilebilirlik | En iyi uygulamalar | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 54 | 96 | 77 | 100 | 4,6 sn | 930 ms | 0 |
| `/araclarimiz` | 75 | 100 | 77 | 100 | 3,7 sn | 330 ms | 0 |
| `/iletisim` | 68 | 97 | 77 | 100 | 4,2 sn | 450 ms | 0 |

**Bu performans sayıları geçerli değil.** Ölçüm geliştirme sunucusunda (`next dev`) yapılmış: sayfada HMR istemcisi ve 860 KB'lık Next geliştirici araçları var, JavaScript sıkıştırılmamış ("Minify JavaScript", "Missing source maps" uyarıları buradan). Ayrıca Kaspersky her sayfaya 146 KB'lık bir script ekliyor (render'ı ~1,35 sn bloke ediyor, "Does not use HTTPS" uyarısının sebebi de bu). Yeniden ölçüm: `pnpm build` + `pnpm --filter @novera/web start`, Kaspersky'nin web trafiğine script ekleme ayarı kapalı.

Gerçek bulgular ve durumları:

- Erişilebilirlik, ana sayfa: kampanya şeridi `ul` içinde `role="group"` olan `li`'ler; liste kuralı bozuluyordu. **Düzeltildi** (`fix/lighthouse-a11y`).
- Erişilebilirlik, İletişim: bayi kartındaki `dl` tek başına bir `dt` ile başlıyordu. **Düzeltildi** (aynı dal).
- Konsol hatası: `manifest.webmanifest` 500. Geliştirme sunucusunun eski modül önbelleğinden (dal değişiminden sonra yeniden başlatılmamış); üretim derlemesinde 200 dönüyor. Sunucuyu yeniden başlatmak yeterli.
- "Legacy JavaScript" (`Array.prototype.at`): Next'in kendi paketinde, 8 KB. Bizim kodumuz değil.
- CLS her sayfada 0, SEO her sayfada 100.
