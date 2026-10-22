# V2-37 · Faturalar: panelde oluşturma, Filom'da görüntüleme

**Faz:** 8 · Filom maliyetleri · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-36
**Belgeler:** FLEET.md §3, §4, §5 · ADMIN.md §3

## Amaç
Akıllı Kurumsal Filo'daki "faturaları tek tıkla takip edin" vaadini çalıştırmak.

## Kapsam
- **Veri modeli:** `FleetInvoice`. Numara sequence ile; satırlar JSON (sözleşme, açıklama, tutar); ara toplam, KDV (%20), toplam; `paidAt`.
- **Fatura üretimi:** `POST /admin/invoices/generate?period=YYYY-MM`.
  - O dönemde etkin her sözleşme için şirket başına tek fatura üretilir.
  - Kısmi ay gün oranıyla hesaplanır (kural PR'da belgelenir).
  - Aynı dönem ikinci kez `409 ALREADY_GENERATED`.
- **Diğer uçlar:**
  - `GET /admin/invoices`, `PATCH /admin/invoices/{number}` (ödendi işareti);
  - `GET /fleet/invoices`, `GET /fleet/invoices/{number}`.
- **Durum:** "Gecikti" saklanmaz, son ödeme tarihinden hesaplanır.
- **Ekranlar:**
  - `/yonetim/faturalar`: dönem seç → "Faturaları oluştur" onayı; liste; ödendi işareti.
  - `/filom/faturalar` ve detay: satırlar, KDV, "örnek fatura, yasal belge değildir" notu; yazdırma CSS'i (`@media print`).
- **Filom Özet:** "bu ayın faturası" ve "ödenmemiş toplam" kartları.
- **Seed:** son 3 ayın faturaları.

## Kabul kriterleri
- [ ] Aynı dönem ikinci kez üretilemez (test).
- [ ] Kısmi ay ve KDV hesabı testli; satır toplamı faturayla kuruşu kuruşuna tutar.
- [ ] Başka şirketin faturası 404.
- [ ] Yazdırma önizlemesinde navbar ve footer yok, fatura tek sayfaya sığar (ekran görüntüsü).
- [ ] e2e: panelde oluştur → Filom'da görünür → ödendi işaretle → durum güncel.

## Etiketler
`faz-8` `ozellik` `P2` `api` `web` `veritabani`
