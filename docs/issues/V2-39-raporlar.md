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
- [ ] Rapor toplamları faturalar ve masraflarla kuruşu kuruşuna tutar (test).
- [ ] Grafikler klavye ve ekran okuyucuyla tablodan okunabilir; axe temiz.
- [ ] Boş dönemde anlamlı boş durum.
- [ ] 375/1280 ekran görüntüsü.

## Etiketler
`faz-9` `ozellik` `P2` `api` `web`
