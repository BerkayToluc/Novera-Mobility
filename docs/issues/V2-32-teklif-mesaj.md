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
- [ ] Geçersiz geçiş `409` (test).
- [ ] İç not `/me/quotes` cevabında yok (test).
- [ ] e2e: teklifi "Teklif verildi" yap → müşterinin ekranında durum güncel (mock).
- [ ] Mesaj "ele alındı" işaretlenir ve geri alınır.
- [ ] **V2-25'ten devreden (unutma):** `GET /admin/summary`'deki `unhandledMessages` artık `null` değil, `handledAt` boş olan mesajları sayar (`apps/api/src/admin/admin-summary.service.ts`; anonimleştirilmiş eski mesajların sayılıp sayılmayacağına karar ver). Özet'teki "Ele alınmamış mesaj" kartı görünür ve `/yonetim/mesajlar?durum=ele-alinmadi` bağlantısı çalışır (`lib/admin-screens.ts`'te `messages` `ready` olunca kendiliğinden). `openapi.yaml` `AdminSummary.unhandledMessages` açıklaması, `mocks/admin.ts`, `admin-summary.integration.spec.ts` ve `tests/admin-summary.test.ts` güncellenir.
- [ ] İşlem kaydı; yetki testleri; 375/1280 ekran görüntüsü.

## Etiketler
`faz-5` `ozellik` `P2` `api` `web` `veritabani`
