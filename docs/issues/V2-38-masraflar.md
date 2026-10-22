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
- [ ] Zimmet değişim anının iki yanındaki masraf doğru kişiye eşlenir (test).
- [ ] Toplu yansıtma yalnızca Açık olanları değiştirir; başka şirketin kimliği yok sayılır ya da 404 olur (test).
- [ ] Yenileme talebi panelde Teklifler'de görünür (test + e2e).
- [ ] e2e: panelde HGS gir → Filom'da personelde görünür → yansıt.
- [ ] 375/1280 ekran görüntüsü; axe temiz.

## Etiketler
`faz-8` `ozellik` `P2` `api` `web` `veritabani`
