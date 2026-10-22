# V2-31 · Yönetim > Rezervasyonlar: liste, arama, detay, iptal

**Faz:** 5 · Operasyon · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-24
**Belgeler:** ADMIN.md §3, §3.2, §4

## Amaç
Çalışanın rezervasyonları bulabilmesi, ayrıntısını görebilmesi ve gerektiğinde iptal edebilmesi.

## Kapsam
- **API:**
  - `GET /admin/reservations`: numara ya da e-posta araması; durum, alış bayisi ve tarih aralığı süzgeci; sayfalı.
  - `GET /admin/reservations/{number}`: fiyat dökümü, kod, puan, müşteri, araç, bayiler.
  - `POST /admin/reservations/{number}/cancel`: `{ reason }` zorunlu (5–500 karakter).
- **İptal kuralı:**
  - kullanıcı iptaliyle aynı servis kullanılır (puan iadesi, bekleyen puan düşer, kod kullanımı geri döner);
  - başlamış ya da zaten iptal edilmiş rezervasyonda `409 INVALID_TRANSITION`;
  - `cancelledAt`, `cancelReason`, `cancelledById` dolar;
  - e-posta V2-44'te.
- **Ekran:**
  - `/yonetim/rezervasyonlar`: liste, süzgeçler adreste;
  - `/yonetim/rezervasyonlar/:numara`: detay ve "Rezervasyonu iptal et" onay penceresi (neden alanıyla).

## Kabul kriterleri
- [ ] Panel iptali kullanıcı iptaliyle aynı puan sonucunu verir (entegrasyon testi).
- [ ] Başlamış rezervasyon iptal edilemez.
- [ ] Müşterinin Rezervasyonlarım ekranında iptal görünür.
- [ ] İşlem kaydında `reservation.cancel` var.
- [ ] e2e: arama → detay → iptal; süzgeç adreste.
- [ ] 375/1280 ekran görüntüsü; axe temiz.

## Etiketler
`faz-5` `ozellik` `P2` `api` `web`
