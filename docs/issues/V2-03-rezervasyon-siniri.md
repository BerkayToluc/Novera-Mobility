# V2-03 · Rezervasyon oluşturmaya hız sınırı ve kişi başı tavan

**Faz:** 1 · Acil güvenlik · **Öncelik:** P0 · **Boyut:** S · **Bağımlı:** V2-02
**Bulgular:** QUALITY G-02, G-16 · **Karar:** SPEC §7, tavan değeri (öneri 3)

## Amaç
Ödeme alınmadan CONFIRMED rezervasyon açılabiliyor. Bu yüzden tek bir hesap tüm filoyu aylarca kilitleyebilir. Bu iş bunu durdurur.

## Kapsam
- **Hız sınırı:** `POST /reservations` için kullanıcı başına saatte en çok 10 istek. Şimdilik mevcut bellek içi sınırlayıcı kullanılır; V2-09 kalıcı depoya taşır.
- **Kişi başı tavan:**
  - Bir kullanıcının aynı anda en çok **N** gelecek ya da devam eden `CONFIRMED` rezervasyonu olabilir (N için SPEC §7, öneri 3).
  - Aşılırsa `422 RESERVATION_LIMIT`.
  - Sayım ve ekleme aynı işlemde, kullanıcı satırı kilitlenerek yapılır (puan kilidiyle aynı sırada).
- **Fiyat ucu:** `POST /reservations/price` için istemci başına 10 dakikada 60 istek.
- **Tutma sahipliği:**
  - Rezervasyon `holdId` ile oluşturulurken tutmanın istemci anahtarı (ya da oturumu) isteği yapanla eşleşmelidir.
  - Eşleşmezse tutma yokmuş gibi davranılır; araç müsait değilse `409 VEHICLE_UNAVAILABLE`.
- **Web:** `RESERVATION_LIMIT` için özet ve ödeme sayfasında anlamlı bir mesaj ve Rezervasyonlarım'a bağlantı (TR/EN).

## Kapsam dışı
Kalıcı sınır deposu (V2-09).

## Teknik notlar
- Kod: `apps/api/src/reservations/reservations.controller.ts:198-205`, `reservations.service.ts:338-350` (tutma tüketimi), `forms/rate-limiter.ts`.
- `docs/api/openapi.yaml`: `RESERVATION_LIMIT` ve `429` eklenir.
- SECURITY.md hız sınırı tablosuna yeni satırlar eklenir.

## Kabul kriterleri
- [ ] N+1'inci gelecek rezervasyon `422 RESERVATION_LIMIT` döner; biri iptal edilince yenisi açılabilir.
- [ ] Aynı anda gelen iki istek tavanı aşamaz (entegrasyon testi).
- [ ] Saatteki 11. istek `429` döner.
- [ ] Başka istemcinin tutmasıyla rezervasyon açılamaz.
- [ ] Web'deki mesaj iki dilde.
- [ ] QUALITY'de G-02 ve G-16 güncel; SECURITY.md tablosu güncel.

## Test
- API entegrasyon testleri (gerçek Postgres): tavan, eşzamanlılık, tutma sahipliği.
- Web e2e: tavan mesajı (mock).

## Etiketler
`faz-1` `guvenlik` `P0` `api` `web`
