# V2-30 · Araç yönetimi (ekle, taşı, kaldır) ve ek hizmetler

**Faz:** 4 · Katalog · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-27, V2-29
**Belgeler:** ADMIN.md §3.1, §4

## Amaç
G'nin isteği: kiralık filoya fiziksel araç eklemek ve çıkarmak. Ayrıca ek hizmet fiyatlarını panelden düzenlemek.

## Kapsam
- **API:**
  - `GET/POST /admin/vehicles`, `PATCH /admin/vehicles/{id}` (bayi, `active`);
  - liste süzgeçleri: model, bayi, durum, plaka araması.
- **Kurallar:**
  - plaka Türk plaka biçiminde, büyük harfe çevrilir ve benzersizdir (filo araçlarıyla da çakışmaz; V2-35'ten sonra denetlenir);
  - yıl 2015 ile bu yıl + 1 arasında;
  - kapalı bayiye ya da kaldırılmış modele araç eklenemez (`422`);
  - kaldırma (`active = false`) ve bayi değişikliği, gelecek rezervasyonu ya da etkin tutması olan araçta `409 IN_USE`.
- **Ek hizmetler:** `GET /admin/extras`, `PATCH /admin/extras/{slug}` ile ad (TR/EN) ve fiyat düzenlenir. Yeni ek hizmet eklenmez.
- **Ekranlar:** `/yonetim/araclar` (liste, "Yeni araç", bayi değiştirme, kaldırma ve geri alma onayı) ve `/yonetim/ek-hizmetler`.
- **Önbellek:** arama müsaitliği önbelleğe alınmaz; `extras` etiketi temizlenir.

## Kabul kriterleri
- [x] Yeni araç, bayisinde ve uygun tarihlerde aramada müsait görünür (e2e mock + canlı G denemesi). _Nasıl: API entegrasyon testi gerçek müsaitlik aramasında aracı bulur; kapatınca düşer, açınca döner. Örnek modda `tests/admin-vehicles.test.ts` aramada görünmesini doğrular. Canlı deneme G'ye kalır._
- [x] Gelecek rezervasyonlu araç kaldırılamaz ve taşınamaz (test). _Nasıl: entegrasyon testleri (`IN_USE` + sayılar, süresi dolmuş tutma ve geçmiş rezervasyon engellemez, kilit yarışı) ve `e2e/admin-vehicles.spec.ts`._
- [x] Aynı plaka ikinci kez eklenemez. _Nasıl: entegrasyon testi (`409 PLATE_TAKEN`, farklı yazımlarla da) ve veritabanı `UNIQUE`; e2e'de alan hatası._
- [x] Ek hizmet fiyat değişikliği yeni özet hesabında görünür, eski rezervasyonda değişmez. _Nasıl: `extras.integration.spec.ts` yeni fiyatı `PricingService` hesabında, eski `ReservationExtra.unitPrice`'ı değişmemiş olarak doğrular._
- [x] Yetki, doğrulama ve çakışma testleri; işlem kaydı; 375/1280 ekran görüntüsü. _Nasıl: HTTP 401/403/422/404/415 testleri (`admin.http.spec.ts`), `vehicles.audit.spec.ts`, `STALE_WRITE` entegrasyon testleri; ekran görüntüleri PR'da._

## Etiketler
`faz-4` `ozellik` `P2` `api` `web`
