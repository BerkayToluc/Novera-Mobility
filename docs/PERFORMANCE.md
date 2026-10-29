# Hız ölçümü (PERFORMANCE)

> Durum: **v2.0** · 28 Ekim 2026 · V2-21 (QUALITY P-03, P-04). v1'in ölçümü [archive/v1/PERFORMANCE.md](archive/v1/PERFORMANCE.md) içindedir ve geçersizdir (geliştirme sunucusunda alınmıştı).
> Hedef (SPEC §5, mobil, production build): LCP < 2,5 sn · INP < 200 ms (laboratuvarda TBT < 200 ms) · CLS < 0,1.

## Yöntem

- **Ortam:** production build (`pnpm build`), gerçek API (`node apps/api/dist/main`) ve tohumlanmış PostgreSQL (`novera_smoke`), `next start`. `USE_MOCKS` kapalı. Bulut geliştirme makinesi, yerel ağ.
- **Araç:** Lighthouse 12.8.2, mobil profil (Moto G Power, simüle edilmiş Slow 4G, 4x işlemci yavaşlatma), yalnızca "Performance" kategorisi, temiz Chromium profili.
- **Sayı:** her sayfada üç ölçüm, tabloda **ortanca**.
- **Sınır:** Sayılar bu makinenin işlemcisine bağlıdır; Lighthouse işlemci yavaşlatmasını simüle eder. G'nin telefonundaki ya da Vercel önizlemesindeki sayı farklı çıkabilir. Vercel önizlemesinde ve gizli pencerede ayrıca ölçmek gerekir (aşağıda "Doğrulanmadı").

## Sonuç (V2-21 değişikliklerinden sonra)

| Sayfa | Performans | LCP | CLS | TBT | JS (aktarım) | Hedef |
|---|---|---|---|---|---|---|
| `/` | 74 | 4,40 sn | 0,004 | 395 ms | 332 KB | LCP ✗ · CLS ✓ · TBT ✗ |
| `/araclar` | 86 | 3,23 sn | 0,030 | 320 ms | 278 KB | LCP ✗ · CLS ✓ · TBT ✗ |
| `/urunler/akilli-kurumsal-filo` | 94 | 2,82 sn | 0,057 | 107 ms | 196 KB | LCP ✗ · CLS ✓ · TBT ✓ |
| `/bayilerimiz` | 86 | 2,84 sn | 0,036 | 343 ms | 265 KB | LCP ✗ · CLS ✓ · TBT ✗ |

Değişiklikten önce (aynı yöntem): `/` 67 · 4,46 sn · 646 ms; `/araclar` 88 · 2,80 sn · 331 ms; ürün sayfası 95 · 2,68 sn · 106 ms; `/bayilerimiz` 87 · 3,31 sn · 259 ms. Fark ölçüm gürültüsü sınırındadır: değişiklik bu sayfaların ilk ekranını etkilemiyor (aşağıya bakın).

**Hedef tutmadı: LCP dört sayfada da 2,5 sn'nin üstünde, TBT üç sayfada 200 ms'nin üstünde. CLS her yerde hedefte.**

## Okuma

- **LCP elemanı fotoğraf değil.** Dört sayfada da LCP, ilk ziyarette çıkan çerez bandının metni (`ConsentBanner`); bandı olmayan ziyarette (onay çerezi varken `/araclar`) LCP'nin elemanı `h1`, 3,6 sn. Bu sayfaların ilk ekranında araç fotoğrafı yok: ana sayfada filo bölümü ekranın altında, `/araclar` arama yapılmadığında boş durum gösteriyor.
- **Gecikme ağda değil, işlemcide.** Aynı sayfa kısıtlamasız (`--throttling-method=provided`) ölçüldüğünde FCP = LCP = 224 ms. Simüle edilmiş ölçümde TTFB ≈ 460 ms, FCP ≈ 1,4 sn, LCP'nin geri kalanı (≈ 2–3 sn) "render gecikmesi": ana iş parçacığı 4x yavaşlamada sayfanın JavaScript'ini (190–330 KB aktarım, 800–1.440 ms betik çalıştırma) işlerken boyama bekliyor. En büyük pay React DOM + Next istemci çalışma zamanında (tek parça ≈ 230 KB, ana sayfada 1,6 sn); yani her sayfanın ortak taban maliyeti.
- **Ana sayfa en ağırı** (332 KB JS, 3,6 sn ana iş parçacığı): hidrate olan istemci bileşenleri ve araç kartları diğer sayfalardan fazla.
- **Fotoğraflar sorun değil:** Next görsel iyileştirici kartlara 37–58 KB'lık WebP sunuyor (`sizes` doğru). Kaynak dosyalar bütçenin (≈120 KB) üstündeydi; kullanılan 4 tanesi küçültüldü (aşağıda).

## Yapılanlar (V2-21)

- `VehicleImage` `preload` alıyor (Next 16'da `priority`'nin yerine geçti); sonuç listesinin ilk kartı (`/araclar` arama sonucu) bunu kullanıyor, diğer fotoğraflar tembel kalıyor. Yalnızca sonuç listesinin ilk fotoğrafı ekranda görünür olduğu için orada açıldı; ana sayfa ve filo bölümü ekranın altında.
- Bütçeyi aşan fotoğraflar yeniden sıkıştırıldı (`apps/web/scripts/shrink-photos.mjs`, 1280×800 korunur): `dacia-duster` 130 → 118 KB, `hyundai-i20` 172 → 112 KB, `nissan-qashqai` 141 → 115 KB, `renault-megane` 163 → 117 KB; sonradan eklenen `hyundai-ioniq-5` 258 → 118 KB (960×600) ve `peugeot-3008` 185 → 116 KB (1120×700). Betik önce kaliteyi, yetmezse genişliği düşürür.

## Yapılmadı / sonraki adım

- **Eksik fotoğraf kalmadı.** Seed'deki `volkswagen-golf`, `hyundai-tucson`, `volkswagen-id4` ve `audi-a6` modelleri güncel belgelerde (SPEC, PHOTO-CREDITS, web örnek verisi) hiç yoktu; yalnızca seed'deydi. Yerlerine belgelerdeki dört model geldi (`volkswagen-passat`, `toyota-rav4-hybrid`, `hyundai-ioniq-5`, `peugeot-3008`); dördünün fotoğrafı `public/fleet`'te hazırdı ve `PHOTO-CREDITS.md`'de yazılı. 15 modelin hepsinde fotoğraf var, hepsi ≈120 KB altında.
- **LCP ve TBT için asıl iş: hidrasyon maliyeti.** Önerilen ayrı issue: ana sayfa, `/araclar` ve `/bayilerimiz`'de hidrate edilen istemci bileşenlerini azaltmak (sunucu bileşeni olabilecekleri ayırmak, çerez bandı ve ağır bileşenleri tembel yüklemek), sonra bu belgedeki ölçümü yinelemek. Bu, V2-21'in kapsamını aşan bir mimari iştir; G karar verir.

## Doğrulanmadı

- Vercel önizlemesinde ve gerçek telefonda ölçüm yapılmadı.
- INP için gerçek etkileşim ölçümü yok; yalnızca laboratuvar TBT'si.
- Ölçüm tek makinede ve tek seferde alındı; üç ölçüm arasındaki sapma `/` sayfasında belirgin (performans puanı 67–74).
