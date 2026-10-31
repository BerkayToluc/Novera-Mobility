# V2-40 · Yeşil Filo: karbon, batarya sağlığı, şarj durumu ve yakın istasyonlar

**Faz:** 9 · Raporlar · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-39 · **Karar:** SPEC §7 harita
**Belgeler:** FLEET.md §3, §3.1, §4, §5 · ARCHITECTURE ADR-30 · SPEC §3.E

## Amaç
Yeşil Filo ürünündeki vaatleri çalıştırmak: "anlık batarya sağlığı, şarj istasyonu durumu ve karbon emisyon tasarrufu raporlaması".

## Kapsam
- **`GET /fleet/green`:** elektrikli ve hibrit araçların son şarj seviyesi, batarya sağlığı eğilimi (son 6 ayın okumaları) ve dönemlik karbon tasarrufu. Katsayılar FLEET.md §3.1'de; tek yerde (`fleet-report.ts`).
- **`ChargingStation` seed'i:** filo şehirlerinde toplam ~30 kurgusal istasyon (ad, şehir, konum, soket türleri).
- **`GET /fleet/vehicles/{plate}/charging-stations?limit=5`:**
  - uzaklık aracın simüle konumundan hesaplanır (V2-43 hazır değilse zimmet şehrinin merkezinden);
  - durum (müsait, dolu, arızalı) 5 dakikalık dilimle deterministik üretilir (ADR-30);
  - cevapta `simulated: true`.
- **Ekran `/filom/yesil-filo`:**
  - karbon özeti ("örnek hesap" notu);
  - araç başına batarya sağlığı çizgisi ve tablosu;
  - şarj seviyesi;
  - araç seçilince yakın istasyonlar listesi;
  - harita kararına göre isteğe bağlı küçük harita; harita yoksa ya da yüklenmezse liste yeterli;
  - her simülasyon verisinde "Simülasyon" rozeti.
- **Görünürlük:** yalnızca elektrikli/hibrit aracı olan şirkette menüde görünür.

## Kabul kriterleri
- [x] Simülasyon aynı araç ve dilim için aynı sonucu verir (test). _`simulation.spec.ts` (aynı anahtar ve dilim aynı sayı, durum dağılımı ~%60/30/10), `fleet-green.integration.spec.ts` (aynı araç ve dilimde cevap birebir aynı, dilim içinde iki dakika sonrası da; bir günde durumlar değişir); web testi API'nin verdiği sayıları sabitleyerek `lib/simulation.ts`'in aynı aritmetik olduğunu gösterir._
- [x] Karbon hesabı katsayılarla tutar (test). _`simulation.spec.ts` (170/105/45 ve tam gram), entegrasyon testi: 800 km elektrikli = 800 × 125 g, 500 km hibrit = 500 × 65 g, toplamlar; `tests/green.test.ts` örnek modda aynı._
- [x] Elektrikli aracı olmayan şirkette menü öğesi yok, adres boş durum gösterir. _API: `greenVehicles` 0 ve `vehicles: []` (entegrasyon testi). e2e: örnek şirketin elektrikli aracı panelden iade edilince menüde "Yeşil Filo" kalkar, "Raporlar" kalır, adres "Yeşil Filo'da araç yok" der._
- [x] e2e: Yeşil Enerji Ltd. ile istasyon listesi ve rozet. _Yeşil Enerji Ltd. seed şirketidir, sample modda yoktur; e2e aynı akışı sample şirket Ege Lojistik'in elektrikli aracıyla koşar (5 istasyon, uzaklık, durum sözcüğü, "Simülasyon" rozeti). Seed şirketiyle olan hali `fleet-green.integration.spec.ts` ve `fleet.seed.integration.spec.ts` düzeyinde sınanır, tarayıcıda gerçek API ile sınanmadı._
- [x] 375/1280 ekran görüntüsü; axe temiz. _Ekran görüntüsü artık istenmiyor; e2e mobil 375 ve masaüstü 1280'de koşar, her test axe ile biter, mobilde yatay sayfa kayması yok denetlenir._

## Etiketler
`faz-9` `ozellik` `P2` `api` `web` `veritabani`
