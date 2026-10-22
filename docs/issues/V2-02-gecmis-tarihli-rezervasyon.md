# V2-02 · Geçmiş tarihli rezervasyonu engelle ve puan kazanımını düzelt

**Faz:** 1 · Acil güvenlik · **Öncelik:** P0 · **Boyut:** S · **Bağımlı:** V2-01
**Bulgular:** QUALITY G-01 (Kritik)

## Amaç
Bugün API, başlangıcı geçmişte olan tutmayı ve rezervasyonu kabul ediyor. Böyle bir rezervasyonun bitişi de geçmişte kaldığı için puanı hemen bakiyeye geçiyor. Sonuç: sınırsız puan ve puanla yarı fiyata kiralama.

Bu iş iki şey yapar:
- açığı kapatır;
- canlıda bu açığın kötüye kullanılıp kullanılmadığını ortaya çıkarır.

## Kapsam
- **Başlangıç kontrolü:** `POST /holds`, `POST /reservations/price`, `POST /reservations` ve müsaitlik araması (`GET /vehicles`) için `startAt` şu andan en az 30 dakika sonra olmalı (bir sonraki 30 dakikalık dilim). Değilse `422 VALIDATION_FAILED`, `fieldErrors.startAt = "IN_PAST"`.
- **En ileri başlangıç:** bugünden 365 gün sonrası (`OUT_OF_RANGE`). Bugünkü en uzun kiralama süresi kuralı aynen kalır.
- **Puan:** kazanılan puanın bakiyeye geçmesi için üç koşulun hepsi gerekir:
  - rezervasyon `CONFIRMED`;
  - `endAt <= now`;
  - rezervasyon başlangıcından önce oluşturulmuş (`createdAt < startAt`).

  Böylece veritabanında kalmış geçmiş tarihli kayıtlar puan vermez.
- **Web:** arama formu ve özet zaten geçmiş tarih seçtirmiyor. API'nin `IN_PAST` kodu için TR/EN hata metni eklenir (`messages/*/booking.json`).
- **Canlı tespit:**
  - `startAt < createdAt` olan rezervasyonları listeleyen salt okunur bir SQL sorgusu `docs/SECURITY.md`'ye yazılır.
  - Berkay sorguyu canlıda çalıştırır ve sonucu (yalnızca sayı, kişisel veri yok) issue'ya yazar.
  - Kayıt çıkarsa ne yapılacağına G karar verir.

## Kapsam dışı
- Hız sınırı ve tavan (V2-03).
- Doğrulamanın zod'a taşınması (V2-07). Bu işte kural mevcut el yazısı doğrulamaya eklenir.

## Teknik notlar
- Aynı kuralın üç yeri:
  - `apps/api/src/reservations/reservation-input.ts:71-102` (tarih okuma);
  - `holds/holds.service.ts:217-233`;
  - `catalog/catalog.service.ts:178-204`.

  Kural tek bir yardımcıda yazılır, üçü onu çağırır. Yardımcı şimdilik `reservations/` altında durur; V2-13 onu `common/`'a taşır.
- Puan hesabı: `reservations/points-balance.ts:36-40`.
- Şimdiki zaman, testte sabitlenebilen bir saat kaynağından okunur. Projede böyle bir desen varsa o kullanılır.
- `docs/api/openapi.yaml`: `IN_PAST` alan kodu eklenir.

## Kabul kriterleri
- [ ] Geçmiş başlangıçlı tutma, fiyat, rezervasyon ve arama istekleri `422` + `IN_PAST` döner.
- [ ] 30 dakikadan yakın başlangıç reddedilir; tam bir sonraki dilim kabul edilir.
- [ ] `createdAt >= startAt` olan rezervasyon puan bakiyesine katılmaz (Puanlarım'da görünmez).
- [ ] Web'deki hata metni iki dilde.
- [ ] Canlı tespit sorgusu SECURITY.md'de, sonucu issue'da.
- [ ] QUALITY.md'de G-01 "Düzeltildi".

## Test
- API birim ve HTTP testleri: dört uçta geçmiş, sınırda ve geçerli başlangıç; puan hesabında geçmiş tarihli kayıt.
- Mevcut testlerdeki sabit tarihler gerekirse göreli tarihe çevrilir.

## Etiketler
`faz-1` `guvenlik` `P0` `api` `web`
