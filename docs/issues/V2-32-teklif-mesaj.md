# V2-32 · Yönetim > Teklif talepleri ve iletişim mesajları

**Faz:** 5 · Operasyon · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-24
**Belgeler:** ADMIN.md §3, §3.2, §4, §5

## Amaç
Bugün kurumsal teklif talepleri ve iletişim mesajları yalnızca veritabanına düşüyor; çalışan bunları göremiyor. Hedef: talepleri ve mesajları panelden takip etmek.

## Kapsam
- **Veri modeli:**
  - `QuoteRequest`: `internalNote`, `updatedAt`, `source` (`WEB`, `FLEET_RENEWAL`); `QuoteStatus`'a `CLOSED` eklenir.
  - `ContactMessage`: `handledAt`, `handledById`.
- **API:**
  - `GET /admin/quotes`, `GET/PATCH /admin/quotes/{number}`: `status` ve `internalNote`.
  - Geçişler `RECEIVED → IN_REVIEW → OFFERED → CLOSED`; atlama ileri yönde serbest, geri gidiş `409 INVALID_TRANSITION`.
  - `GET /admin/contact-messages`, `GET/PATCH /admin/contact-messages/{id}`: `handled: true/false`.
- **Müşteri tarafı:** kurumsal kullanıcının "Teklif taleplerim" ekranında durum görünür; iç not **görünmez** (cevap şemasında yok).
- **Ekranlar:**
  - `/yonetim/teklifler`: liste, durum süzgeci; detayda durum düğmeleri ve iç not.
  - `/yonetim/mesajlar`: liste, "ele alınmadı" süzgeci; detayda işaret.

## Kabul kriterleri
- [x] Geçersiz geçiş `409` (test). _Nasıl: `quotes.integration.spec.ts` "never goes back": `409 INVALID_TRANSITION`, aynı istekteki not da yazılmaz, kapanmış talep yeniden açılamaz; HTTP testlerinde durum kodu 422._
- [x] İç not `/me/quotes` cevabında yok (test). _Nasıl: entegrasyon testi cevabın alan listesini sabitler (`createdAt, durationMonths, id, number, productSlug, status, vehicleCount`) ve metinde not geçmediğini doğrular._
- [x] e2e: teklifi "Teklif verildi" yap → müşterinin ekranında durum güncel (mock). _Nasıl: `e2e/admin-quotes.spec.ts` "goes forward"; kapatınca müşteri "Kapandı" da görür._
- [x] Mesaj "ele alındı" işaretlenir ve geri alınır. _Nasıl: `messages.integration.spec.ts` ve `e2e/admin-messages.spec.ts` (özet sayısı da düşer ve geri döner)._
- [x] **V2-25'ten devreden (unutma):** `GET /admin/summary`'deki `unhandledMessages` artık `null` değil, `handledAt` boş olan mesajları sayar (`apps/api/src/admin/admin-summary.service.ts`; anonimleştirilmiş eski mesajların sayılıp sayılmayacağına karar ver). Özet'teki "Ele alınmamış mesaj" kartı görünür ve `/yonetim/mesajlar?durum=ele-alinmadi` bağlantısı çalışır (`lib/admin-screens.ts`'te `messages` `ready` olunca kendiliğinden). `openapi.yaml` `AdminSummary.unhandledMessages` açıklaması, `mocks/admin.ts`, `admin-summary.integration.spec.ts` ve `tests/admin-summary.test.ts` güncellenir. _Nasıl: karar, silinmiş (anonimleştirilmiş) mesaj **sayılmaz** (yanıtlanacak bir şey kalmamıştır); `admin-summary.integration.spec.ts` bunu doğrular, `messages.integration.spec.ts` kartın sayısının açtığı listenin toplamıyla aynı olduğunu doğrular; `e2e/admin-summary.spec.ts` ve `e2e/admin-messages.spec.ts` kartı ve bağlantıyı doğrular. `serviceRequests` V2-41'e kadar `null` kalır (aynı sözle)._
- [x] İşlem kaydı; yetki testleri; 375/1280 ekran görüntüsü. _Nasıl: `quotes.audit.spec.ts` (eylem, numara/kimlik, yalnızca alan adları; not, ad ve mesaj metni yok), HTTP 401/403/404/415/422 testleri; ekran görüntüleri PR'da._

## Etiketler
`faz-5` `ozellik` `P2` `api` `web` `veritabani`
