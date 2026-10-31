# V2-39 · Filom raporları: maliyet ve kilometre

**Faz:** 9 · Raporlar · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-38
**Belgeler:** FLEET.md §3, §3.1, §4 · DESIGN.md §8 (grafikler)

## Amaç
Filo yöneticisinin araç, departman ve ay bazında ne harcadığını görmesi.

## Kapsam
- **`GET /fleet/reports?from=&to=`:**
  - dönemde araç başına, departman başına ve ay başına maliyet;
  - maliyet = fatura payı (araç başına eşit bölüşüm, kural belgelenir) + masraflar;
  - kilometre (okumalardan, dönem başı ve sonu farkı);
  - en çok 24 ay.
- **Ekran `/filom/raporlar`:**
  - dönem seçimi (bu ay, son 3 ay, bu yıl, özel);
  - sade çubuk grafikler; en çok 4 seri, marka paleti;
  - **her grafiğin altında aynı verinin tablosu.**
  - Grafik kütüphanesi seçimi PR'da gerekçelenir. Bağımlılık eklemeden SVG ile çizmek tercih edilir; paket eklenirse boyutu yazılır ve paket yalnızca bu rotada yüklenir.
- **Filom Özet:** "bakım ya da muayenesi yaklaşan araçlar" kartı.

## Kabul kriterleri
- [x] Rapor toplamları faturalar ve masraflarla kuruşu kuruşuna tutar (test). _`fleet-reports.integration.spec.ts`: veritabanında fatura ara toplamlarının ve masrafların `aggregate`'iyle karşılaştırılır; aylar, departmanlar ve araçlar (+ `unallocated`) aynı toplamı verir; üç araca bölünen satırda kuruş kaybolmaz. `report-calc.spec.ts` ve `tests/reports.test.ts` aynı kuralı birim düzeyinde sınar._
- [x] Grafikler klavye ve ekran okuyucuyla tablodan okunabilir; axe temiz. _Resim `aria-hidden`, altındaki tablo `caption`, `scope` ve odaklanabilir kaydırma kutusuyla okunur; `e2e/reports.spec.ts` her testin sonunda axe çalıştırır (375 ve 1280). NVDA ile elle dinleme yapılmadı._
- [x] Boş dönemde anlamlı boş durum. _"Bu dönemde veri yok" ve "Bu yılı göster" bağlantısı (e2e)._
- [x] 375/1280 ekran görüntüsü. _Ekran görüntüsü artık istenmiyor; e2e iki genişlikte (mobil 375, masaüstü 1280) koşar, mobilde yatay sayfa kaymasının olmadığı denetlenir._

## Etiketler
`faz-9` `ozellik` `P2` `api` `web`
