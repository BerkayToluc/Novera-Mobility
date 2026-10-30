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
- [x] Panel iptali kullanıcı iptaliyle aynı puan sonucunu verir (entegrasyon testi). _Nasıl: `reservations.integration.spec.ts` "gives the same result as the customer cancelling": iki hesapta harcanan puan geri gelir, bekleyen puan düşer, kod kullanımı geri gelir; iki hesap da iptal öncesindeki bakiyeye döner._
- [x] Başlamış rezervasyon iptal edilemez. _Nasıl: entegrasyon testi (`409 INVALID_TRANSITION`, hiçbir şey değişmez) ve e2e (düğme yok, sayfa nedeni söyler)._
- [x] Müşterinin Rezervasyonlarım ekranında iptal görünür. _Nasıl: gerçek API'de iptal aynı `status` alanıdır (entegrasyon testi müşteri tarafı `GET /me/reservations` ile aynı satırı okur); örnek modda e2e müşteri ekranını açıp iptali görür._
- [x] İşlem kaydında `reservation.cancel` var. _Nasıl: `reservations.audit.spec.ts` (eylem, numara, yalnızca `reason` alan adı; neden ve müşteri bilgisi yok)._
- [x] e2e: arama → detay → iptal; süzgeç adreste. _Nasıl: `e2e/admin-reservations.spec.ts`._
- [x] 375/1280 ekran görüntüsü; axe temiz. _Nasıl: PR'daki görüntüler; her Playwright testi axe ile biter._

## Etiketler
`faz-5` `ozellik` `P2` `api` `web`
