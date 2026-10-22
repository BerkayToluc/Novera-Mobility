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
- [ ] Simülasyon aynı araç ve dilim için aynı sonucu verir (test).
- [ ] Karbon hesabı katsayılarla tutar (test).
- [ ] Elektrikli aracı olmayan şirkette menü öğesi yok, adres boş durum gösterir.
- [ ] e2e: Yeşil Enerji Ltd. ile istasyon listesi ve rozet.
- [ ] 375/1280 ekran görüntüsü; axe temiz.

## Etiketler
`faz-9` `ozellik` `P2` `api` `web` `veritabani`
