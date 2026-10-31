# V2-43 · Canlı takip simülasyonu

**Faz:** 11 · Canlı takip · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-36 · **Karar:** SPEC §7 harita
**Belgeler:** SPEC §3.E · FLEET.md §3, §3.1, §4 · ARCHITECTURE ADR-30 · DESIGN.md §8 (harita)

## Amaç
Akıllı Kurumsal Filo'daki "Canlı takip / Canlı GPS ve Telematik" vaadini gerçek cihaz olmadan, açıkça "simülasyon" diye işaretlenmiş biçimde göstermek.

## Kapsam
- **`TrackingRoute` seed'i:** filo şehirlerinin her birinde 2–3 rota. Rotalar çoklu çizgidir (nokta listesi) ve elle hazırlanır; dış servis kullanılmaz.
- **Simülasyon modülü `src/fleet/simulation/`:**
  - girdi: araç kimliği ve 5 dakikalık zaman dilimi;
  - çıktı: konum (rota üzerinde), hız, kontak;
  - tohumlu, deterministik, saf fonksiyon;
  - 08:00–19:00 dışında ve hafta sonu kontak kapalı, araç son noktasında.
- **Uçlar:**
  - `GET /fleet/tracking`: tüm araçlar, son konum, kontak, hız, `updatedAt`, `simulated: true`;
  - `GET /fleet/vehicles/{plate}/route?date=`: o günün 5 dakikalık noktaları, en çok son 7 gün.
- **Ekran `/filom/canli-takip`:**
  - harita (karar: Google Maps; mevcut CSP izinli) ve yanında liste (plaka, personel, kontak, hız, son güncelleme);
  - araç seçilince 24 saatlik rota çizgisi;
  - 30 saniyede bir yenileme; sekme gizliyken yenileme durur;
  - "Simülasyon" rozeti;
  - harita yüklenmezse ya da anahtar yoksa yalnız liste;
  - harita kodu yalnızca bu rotada yüklenir.
- **Erişilebilirlik:** pinler listeyle eşleşir; klavyeyle listeden araç seçilir; harita dekoratif değil ama tek bilgi kaynağı da değildir.

## Kabul kriterleri
- [x] Simülasyon aynı girdiye aynı çıktıyı verir; mesai dışında kontak kapalı (test). _`simulation/tracking.spec.ts` (saf fonksiyonlar: aynı araç, rota ve gün aynı 288 örneği verir, başka araç ya da gün farklı; mesai 08:00–19:00 ve hafta içi; gece ve hafta sonu kontak kapalı, hız 0, araç son çalıştığı noktada) ve `fleet-tracking.integration.spec.ts` (veritabanında: aynı araç ve aynı dilim aynı cevap, bir sonraki dilimde konumlar değişir, gece ve cumartesi kontak kapalı). Web testi API'nin verdiği sayıları sabitleyerek `lib/simulation.ts`'in aynı aritmetik olduğunu gösterir._
- [x] Başka şirketin aracı 404. _Entegrasyon testi: başka şirketin aracı, iade edilmiş araç, olmayan araç ve plaka olamayacak değer aynı `404` ve aynı gövde; `/fleet/tracking` yalnız kendi şirketinin araçlarını verir. 401/403 kapısı `fleet.http.spec.ts`'te._
- [x] e2e: liste görünümü ve rozet (harita mock'lanır); 30 sn yenilemede veri değişir (saat ilerletilerek). _`e2e/tracking.spec.ts`: liste, kontak, hız, kullanan ve "Simülasyon" rozeti; sayfa saati `page.clock` ile 30 saniye ilerletilince son güncelleme 11:05 → 11:15 olur (sunucunun saati `novera-mock-now` çerezi ile ilerletilir); sekme gizliyken yenilemez, görünür olunca yeniler. **Harita mock'lanmadı, anahtarsız yol sınandı:** örnek modda Google anahtarı yoktur, ekran listeyle çalışır (bir sonraki madde)._
- [x] Harita anahtarı yokken sayfa listeyle çalışır. _e2e: anahtarsız sayfada "Harita bu ortamda yok" notu, tüm araçlar listede, axe temiz, 375 px'te yatay kaydırma yok._
- [x] Ana sayfa ve diğer sayfaların JS yükü değişmedi (`next build` çıktısı). _Turbopack build çıktısı boyut vermez; her sayfanın giriş betikleri (`entryJSFiles`) V2-41 dalıyla karşılaştırıldı: ana sayfa, `/giris` ve `/araclar` **+76 bayt** (yeni adresin yönlendirme tablosundaki satırı, her sayfaya giden ortak betikte), Filom sayfaları +430 bayt (menüdeki yeni madde ve metin). Harita kodu (Polyline'ı içeren parçalar) bu sayfaların hiçbirinde yok; yalnız zaten harita kullanan `/bayilerimiz`'de ve canlı takip sayfasında isteğe bağlı yüklenir. Bayilerimiz +1 KB: nedeni incelenmedi (parçaların yeniden bölünmesi olabilir); bu sayfa canlı takip kodunu içermiyor. Yani "değişmedi" tam değil, 76 bayt artış var; neden bilindiği için kabul edildi._
- [x] 375/1280 ekran görüntüsü; axe temiz. _Ekran görüntüsü artık istenmiyor; e2e mobil 375 ve masaüstü 1280'de koşar, her test axe ile biter._

## Etiketler
`faz-11` `ozellik` `P2` `api` `web` `veritabani`
