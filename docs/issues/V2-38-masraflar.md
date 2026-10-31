# V2-38 · Masraflar: HGS, ceza ve bakım; personele yansıtma; sözleşme yenileme talebi

**Faz:** 8 · Filom maliyetleri · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-37
**Belgeler:** FLEET.md §3, §3.1, §4, §5 · SPEC §3.C

## Amaç
Akıllı Kurumsal Filo'daki "HGS masrafları" ve "masraf ve ceza takibini otomatikleştiren arayüz" vaadini çalıştırmak.

## Kapsam
- **Veri modeli:** `FleetExpense`: tür (`HGS`, `PENALTY`, `MAINTENANCE`, `OTHER`), zaman, tutar, açıklama, yer, durum (`OPEN`, `REFLECTED`, `DISPUTED`).
- **Yönetim uçları:** `GET/POST /admin/fleet-expenses`, `PATCH /admin/fleet-expenses/{id}`. Giriş plakayla yapılır; plaka filo aracına çözülür.
- **Müşteri uçları:**
  - `GET /fleet/expenses`: tür, durum, araç, personel ve tarih süzgeci;
  - `PATCH /fleet/expenses/{id}`: Açık ↔ İtiraz edildi, Açık → Yansıtıldı;
  - `POST /fleet/expenses/reflect`: toplu yansıtma, `{ ids }`.
- **Personel eşleme:**
  - masrafın `occurredAt` anında açık zimmet kimdeyse odur;
  - sorgu anında hesaplanır, saklanmaz (ADR-25);
  - zimmet o anda yoksa "Atanmamış".
- **Sözleşme yenileme talebi:** `POST /fleet/contracts/{number}/renewal-request`. Ürün ve araç sayısı dolu bir `QuoteRequest` açar (`source = FLEET_RENEWAL`); talep panelde Teklifler'de görünür.
- **Ekranlar:**
  - `/yonetim/filo-masraflari`: giriş formu ve liste;
  - `/filom/masraflar`: süzgeçler, satır seçimi, "Personele yansıt", "İtiraz et";
  - sözleşme detayında "Yenileme talebi gönder";
  - Filom Özet'te "açık masraflar" kartı.
- **Seed:** 40 civarı HGS ve ceza kaydı.

## Kabul kriterleri
- [x] Zimmet değişim anının iki yanındaki masraf doğru kişiye eşlenir (test). _`expense-calc.spec.ts` (milisaniye sınırı: devir anı yeni alan kişiye), `fleet-expenses.integration.spec.ts` (veritabanında, geriye dönük düzeltme dahil), `tests/expenses.test.ts`._
- [x] Toplu yansıtma yalnızca Açık olanları değiştirir; başka şirketin kimliği yok sayılır ya da 404 olur (test). _`fleet-expenses.integration.spec.ts`: yabancı ya da olmayan kimlik tümünü `404` ile reddeder ve hiçbir şey değişmez (ikisinin cevabı aynı); kendi masraflarından yalnızca Açık ve kişisi olanlar değişir, kalanlar nedenle sayılır; iki eşzamanlı çağrı her masrafı bir kez yansıtır._
- [x] Yenileme talebi panelde Teklifler'de görünür (test + e2e). _Entegrasyon testi `AdminQuotesService.list({ source: 'FLEET_RENEWAL' })` ile bulur; e2e `yonetim/teklifler?kaynak=FLEET_RENEWAL`. İşlemdeki talep varken ikincisi `409 ALREADY_REQUESTED`._
- [x] e2e: panelde HGS gir → Filom'da personelde görünür → yansıt. _`e2e/expenses.spec.ts`: panelde girilen masraf Filom'da Ayşe Demir'le görünür; toplu yansıtma ayrı testte (aynı akışın iki yarısı ayrı dünyalarda koşar)._
- [x] 375/1280 ekran görüntüsü; axe temiz. _Ekran görüntüsü artık istenmiyor; her e2e testi axe ile biter ve `mobile` (375) ile `desktop` (1280) projelerinde koşar._

## Etiketler
`faz-8` `ozellik` `P2` `api` `web` `veritabani`
