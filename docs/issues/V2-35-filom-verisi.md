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
- [x] Her `/fleet/*` ucunda "başka şirketin kaydı 404" ve "bireysel hesap 403" testleri. _Nasıl: `fleet.http.spec.ts` on bir uçta oturumsuz `401`, bireysel hesap / yönetici / şirketsiz kurumsal hesap `403` (yolun büyük/küçük harfi fark etmez); `fleet.integration.spec.ts` iki şirketle: araç, sözleşme, personel ve zimmet için başka şirketin kaydı `404`, gövdedeki başka şirket kaydı olmayanla aynı `422`._
- [x] Açık zimmetli araca yeni zimmet `409 VEHICLE_ASSIGNED` (veritabanı kısıtı + servis). _Nasıl: `fleet.integration.spec.ts` servis `409`'u, aynı anda dört istekte tek kazanan ve doğrudan `prisma` ile ikinci açık zimmet / şirketler arası bağın veritabanınca reddi._
- [x] Panelden sözleşmeye araç eklendi, okuma girildi (e2e mock). _Nasıl: `e2e/admin-contracts.spec.ts` (araç ekle, aynı plaka reddi, okuma, kilometre geri gitmez, iade, sözleşme bitirme); gerçek veritabanıyla `contracts.integration.spec.ts`._
- [x] Seed iki kez çalışınca kopya yok (test). _Nasıl: `fleet.seed.integration.spec.ts`: ikinci çalışma hiçbir şey eklemez, kişinin değiştirdiği kayıt ve kapatılan zimmet geri gelmez, var olan kullanıcının parolası değişmez._
- [x] İşlem kaydı; yetki testleri; ~~375/1280 ekran görüntüsü~~. _Nasıl: `contracts.audit.spec.ts` ve `fleet.http.spec.ts` (şirket satırda, yalnızca alan adları); yönetim uçları için `admin.http.spec.ts` 401/403. Ekran görüntüsü artık istenmiyor (Berkay, 31 Ekim)._

## Etiketler
`faz-7` `ozellik` `P2` `api` `web` `veritabani`
