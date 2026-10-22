# V2-35 · Filom verisi, CompanyGuard ve panelde veri girişi

**Faz:** 7 · Filom temeli · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-33
**Belgeler:** FLEET.md §1, §4.2, §5, §6 · ARCHITECTURE ADR-25

## Amaç
Filom'un veri temelini kurmak ve Novera'nın bu veriyi panelden girmesini sağlamak.

## Kapsam
- **Tablolar:** `CompanyEmployee`, `FleetContract`, `FleetVehicle`, `VehicleAssignment`, `VehicleReading`.
  - Kısıtlar: `FleetContract` için CHECK; plaka benzersizliği (kiralık `Vehicle` plakalarıyla da çakışmaz, servis denetimi); araç başına tek açık zimmet (kısmi benzersiz indeks); okuma yüzdeleri 0–100.
  - Zaman damgaları her tabloda.
- **`CompanyGuard`:**
  - oturum + `accountType = CORPORATE` + `companyId`;
  - bireysel hesapta `403`;
  - her `/fleet/*` sorgusunu `companyId` ile süzen bir yardımcı (başka şirketin kaydı `404`).
- **Yönetim uçları:**
  - `GET/POST /admin/companies/{id}/contracts`, `PATCH /admin/contracts/{number}`;
  - `GET/POST /admin/contracts/{number}/vehicles`, `PATCH /admin/fleet-vehicles/{id}` (bakım/muayene tarihleri, iade);
  - `POST /admin/fleet-vehicles/{id}/readings`.
- **Müşteri okuma uçları:** `/fleet/summary` (temel kartlar), `/fleet/vehicles`, `/fleet/contracts` ve detayları. V2-36 ekranları bunları kullanır; personel ve zimmet uçları da burada yazılır (`/fleet/employees`, `/fleet/assignments`).
- **Panel ekranları:**
  - şirket detayında Sözleşmeler sekmesi;
  - `/yonetim/sirketler/:id/sozlesmeler/:numara`: sözleşme bilgisi, filo araçları (ekle, iade), okuma girişi formu.
- **Seed:** FLEET.md §5'teki iki örnek şirket; kullanıcı parolası ortam değişkeninden. Seed canlıda tekrar çalışınca kopya üretmez.

## Teknik notlar
- Yeni modüller: `src/companies/`, `src/fleet/`.
- `openapi.yaml`'da `/fleet` ve `/admin/contracts` bölümleri.
- Sözleşme numarası sequence ile üretilir (V2-11 deseni).

## Kabul kriterleri
- [ ] Her `/fleet/*` ucunda "başka şirketin kaydı 404" ve "bireysel hesap 403" testleri.
- [ ] Açık zimmetli araca yeni zimmet `409 VEHICLE_ASSIGNED` (veritabanı kısıtı + servis).
- [ ] Panelden sözleşmeye araç eklendi, okuma girildi (e2e mock).
- [ ] Seed iki kez çalışınca kopya yok (test).
- [ ] İşlem kaydı; yetki testleri; 375/1280 ekran görüntüsü (panel ekranları 768'de de).

## Etiketler
`faz-7` `ozellik` `P2` `api` `web` `veritabani`
