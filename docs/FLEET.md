# Filom: kurumsal filo paneli (FLEET)

> Durum: **v2.0** · 22 Ekim 2026. Kapsam SPEC §3.C–§3.E; mimari ARCHITECTURE ADR-25, ADR-30, ADR-31; işler BACKLOG Faz 7–11.
> Berkay'ın 20 Ekim taslağı ([archive/v1/FLEET.md](archive/v1/FLEET.md)) temel alındı. Eklenenler: Talepler (servis ve VIP transfer), Canlı takip (simülasyon), Yeşil Filo şarj durumu ve istasyonlar.
> Uçların kesin biçimi her işin PR'ında `docs/api/openapi.yaml`'a yazılır; çelişki olursa sözleşme kazanır.

## 1. Ne bu

**Filom**, uzun dönem filo kiralayan kurumsal müşterinin filosunu tek ekrandan yönettiği paneldir. Ürün sayfalarında satılan şu vaatlerin çalışan hâlidir:
- Akıllı Kurumsal Filo'daki "Tek ekranda yönetim", "Novera Admin Paneli Dahil", "Canlı takip" ve "Masraf ve ceza takibi";
- Yeşil Filo'daki "Batarya ve şarj" ve "Karbon raporu";
- Hizmetler sayfasındaki yol yardım, ikame araç ve bakım/lastik hizmetleri;
- VIP Mobilite'deki şoför koordinasyonu.

### İki panel nasıl birlikte çalışır

| Novera girer (Yönetim paneli, [ADMIN.md](ADMIN.md)) | Müşteri yönetir (Filom) |
|---|---|
| Şirket, şirketin kullanıcıları (davet), sözleşmeler | Personel listesi |
| Filo araçları (plaka, model, sözleşme), kilometre/şarj/batarya okumaları, bakım ve muayene tarihleri | Zimmet: hangi araç kimde, geçmişi |
| Aylık faturalar (tek düğmeyle), ödendi işareti | Faturaları görür, yazdırır |
| HGS, trafik cezası, bakım masrafı kayıtları | Masrafı personele yansıtır ya da itiraz eder |
| Taleplerin durumunu ilerletir, atanan kişiyi yazar | Talep açar (yol yardım, ikame araç, bakım/lastik, VIP transfer), zaman çizelgesini izler |
| — | Raporlar, Yeşil Filo, canlı takip, sözleşme yenileme talebi |

### Kapsam dışı (SPEC §4)

Gerçek GPS/telematik cihazı, gerçek uçuş takibi, gerçek çekici/servis tedarikçisi, Driver App, SOS, gerçek e-fatura ve ödeme, banka/HGS sistemlerinden otomatik veri, müşterinin araç eklemesi ya da sözleşme imzalaması, şirket içi roller (şirketin tüm kullanıcıları filo yöneticisidir).

## 2. Kim girer

- **Kurumsal hesap** (`accountType = CORPORATE`) bir şirkete bağlıdır (`User.companyId`). Bir şirketin birden çok kullanıcısı olabilir; hepsi aynı filoyu görür.
- **Hesabı Novera açar** (ADMIN.md §3.3). Kişi davet e-postasındaki bağlantıyla şifresini belirler ve `/giris?tip=kurumsal` sayfasından girer.
- **Filom bağlantısı** yalnızca etkin filo sözleşmesi olan şirkette görünür (kurumsal profilin menüsü; `GET /me` cevabındaki `hasFleet` alanı, V2-36). Sözleşmesi olmayan kurumsal hesapta `/filom` "Filonuz henüz yok, teklif alın" boş durumunu gösterir. Bireysel hesap `/filom`'a girince 404 görür.
- **Veri ayrımı:** her `/fleet/*` ucu oturumdaki kullanıcının şirketiyle süzer. Başka şirketin kaydı **404** döner; bu her uç için zorunlu bir testtir.

## 3. Ekranlar

Adres TR `/filom/...`, EN `/en/my-fleet/...`. Hepsi `noindex`, giriş gerektirir. Sitenin navbar ve footer'ı yerindedir; başlıkta şirket adı görünür. Yönetim paneliyle aynı ortak bileşenler kullanılır (V2-24); öncelikli genişlik 375 px (DESIGN.md §8). Metinler `messages/*/fleet-panel.json`.

| Ekran | Adres (TR) | İçerik | İş |
|---|---|---|---|
| Özet | `/filom` | Araç sayısı (zimmetli / boşta), bu ayın faturası ve ödenmemiş toplam, açık masraflar, açık talepler, 60 gün içinde biten sözleşmeler, bakım ya da muayenesi 30 gün içinde olan araçlar. Her kart süzgeçli listeye gider | V2-36 (+ V2-37–V2-41'de kart eklenir) |
| Araçlar | `/filom/araclar`, `.../:plaka` | Liste: plaka, model, sözleşme, kimde, son km, durum; süzgeç. Detay: araç bilgisi, şu anki zimmet ve geçmişi, son okumalar, masraflar, talepler, bakım/muayene tarihleri | V2-36 |
| Canlı takip | `/filom/canli-takip` | Harita + liste: son konum, kontak, hız, son güncelleme; araç seçilince son 24 saatin rotası. "Simülasyon" rozeti, 30 sn yenileme | V2-43 |
| Personel | `/filom/personel` | Ad, soyad, departman, sicil no, e-posta, telefon; ekle, düzenle, pasifleştir (açık zimmeti varsa önce kapanır) | V2-36 |
| Zimmet | araç detayında ve `/filom/zimmet` | Aracı personele ver (başlangıç tarihi), geri al; araç başına tek açık zimmet. Geçmiş tablosu | V2-36 |
| Sözleşmeler | `/filom/sozlesmeler`, `.../:numara` | Ürün, başlangıç-bitiş, aylık bedel, araç sayısı, kalan gün; "Yenileme talebi gönder" (Yönetim > Teklifler'e düşer) | V2-36, V2-38 |
| Faturalar | `/filom/faturalar`, `.../:numara` | Dönem, tutar, son ödeme, durum (Ödendi, Bekliyor, Gecikti); detayda sözleşme bazında satırlar, KDV, "örnek fatura" notu; yazdırılabilir sayfa | V2-37 |
| Masraflar | `/filom/masraflar` | HGS, ceza, bakım, diğer; tarih, araç, tutar, **o anda zimmetli personel**, durum (Açık, Personele yansıtıldı, İtiraz edildi); toplu yansıtma; süzgeç | V2-38 |
| Talepler | `/filom/talepler`, `.../yeni`, `.../:numara` | Liste (tür, araç, durum, tarih), yeni talep (tür seçimi → türe özel form), detay (zimmet anındaki personel, zaman çizelgesi, atanan kişi). Her ekranda operasyon masası telefonu ve "acil durumda 112" notu | V2-41, V2-42 |
| Raporlar | `/filom/raporlar` | Dönem seçimi; araç, departman ve ay bazında maliyet (fatura payı + masraf) ve kilometre; çubuk grafik + tablo | V2-39 |
| Yeşil Filo | `/filom/yesil-filo` | Elektrikli/hibrit araçlarda karbon tasarrufu (örnek hesap), batarya sağlığı eğilimi, şarj seviyesi, araca en yakın şarj istasyonları (simülasyon) | V2-40 |

### 3.1 Davranış kuralları

- **Para ve zaman:** tutarlar TRY'dir ve kullanıcının para birimi tercihinden bağımsız ₺ gösterilir ("Tutarlar TL" notu). Tarihler İstanbul saatiyledir (ADR-16).
- **Masrafın personeli:** masrafın `occurredAt` anında aracın açık zimmeti kimdeyse odur. Zimmet geriye dönük değişirse eşleme yeniden hesaplanır; masrafın durumu ne olursa olsun (ADR-25: saklanmaz, hesaplanır; ayrıntı ve devir anı kuralı ADMIN.md §3.16).
- **Rapor doğruluğu:** rapor sayıları kuruşu kuruşuna faturalar ve masraflarla tutar (test).
- **Karbon tasarrufu (örnek hesap, ekranda yazar):** km × (benzinli eşdeğer emisyon − aracın emisyonu). Katsayılar tek yerde (`fleet-report.ts`) ve burada: benzinli eşdeğer 0,170 kg CO₂/km, hibrit 0,105, elektrikli 0,045 (şebeke payı).
- **Talepler:**
  - Talep açılınca durum `RECEIVED` olur; aynı araçta aynı türde açık talep varsa uyarı çıkar (engel değil).
  - Müşteri yalnızca `RECEIVED` durumundaki talebi iptal edebilir.
  - Türe özel alanlar ve durum akışları SPEC §3.D'dedir.
  - `TRANSFER` türü yalnızca etkin `vip-mobilite` sözleşmesi olan şirkette seçilebilir: başka şirkette seçenek görünmez, API `403` döner. Transferde araç yerine yolcu, uçuş numarası ve karşılama bilgisi girilir.
- **Canlı takip ve şarj** (ADR-30):
  - Konumlar seed'deki şehir rotalarından deterministik üretilir. Araç, zimmetliyse personelin, değilse sözleşmenin teslim şehrinde hareket eder; 08:00–19:00 dışında ve hafta sonu kontak kapalıdır.
  - Şarj istasyonu müsaitliği 5 dakikalık dilimlerle değişir.
  - Cevaplardaki `simulated: true` ekranda rozet olarak görünür. Harita yüklenmezse aynı bilgi listede gösterilir.

## 4. API

### 4.1 Müşteri uçları (`/fleet/*`)

`CompanyGuard` arkasında: oturum + `accountType = CORPORATE` + `companyId` dolu. Sözleşmesi olmayan şirkette liste uçları boş döner. Listeler sayfalıdır (ADR-24).

| Uç | Ne |
|---|---|
| `GET /fleet/summary` | Özet kartlarının sayıları |
| `GET /fleet/vehicles`, `GET /fleet/vehicles/{plate}` | Araçlar ve detay |
| `GET/POST /fleet/employees`, `GET/PATCH /fleet/employees/{id}` | Personel; silme yok, `active: false` (V2-36: tek kişi `GET`'i düzenleme ekranı için eklendi) |
| `GET/POST /fleet/assignments`, `POST /fleet/assignments/{id}/end` | Zimmet; açık zimmetli araca yenisi `409 VEHICLE_ASSIGNED` |
| `GET /fleet/contracts`, `GET /fleet/contracts/{number}`, `POST /fleet/contracts/{number}/renewal-request` | Sözleşmeler ve yenileme talebi (bir `QuoteRequest` açar) |
| `GET /fleet/invoices`, `GET /fleet/invoices/{number}` | Faturalar |
| `GET /fleet/expenses`, `PATCH /fleet/expenses/{id}`, `POST /fleet/expenses/reflect` | Masraflar; durum (Açık ↔ İtiraz edildi, Açık → Yansıtıldı); toplu yansıtma |
| `GET/POST /fleet/requests`, `GET /fleet/requests/{number}`, `POST /fleet/requests/{number}/cancel` | Talepler (ADR-31); `POST` gövdesi `{ type, fleetVehicleId?, details }` |
| `GET /fleet/tracking` | Tüm araçların son konumu, kontak, hız, `updatedAt`, `simulated` |
| `GET /fleet/vehicles/{plate}/route?date=YYYY-MM-DD` | O günün rotası (en çok son 7 gün) |
| `GET /fleet/green` | Elektrikli/hibrit araçlar: şarj, batarya sağlığı eğilimi, karbon özeti |
| `GET /fleet/vehicles/{plate}/charging-stations?limit=5` | En yakın istasyonlar: ad, uzaklık (km), soket türleri, durum, `simulated` |
| `GET /fleet/reports?from=&to=` | Dönem raporu (araç, departman, ay kırılımı) |

### 4.2 Yönetim uçları (ADR-24 kuralları)

| Uç | Ne |
|---|---|
| `GET/POST /admin/companies`, `GET/PATCH /admin/companies/{id}` | Şirket |
| `POST /admin/companies/{id}/users` | Kurumsal kullanıcı daveti |
| `GET/POST /admin/companies/{id}/contracts`, `PATCH /admin/contracts/{number}` | Sözleşme (ürün slug'ı, başlangıç, bitiş, aylık bedel, teslim şehri, durum) |
| `POST /admin/contracts/{number}/vehicles` (araçlar `GET /admin/contracts/{number}`'de gelir), `PATCH /admin/fleet-vehicles/{id}` | Filo aracı (model, plaka, yıl, başlangıç km, bakım ve muayene tarihleri, iade) |
| `POST /admin/fleet-vehicles/{id}/readings` | Okuma: km, yakıt %, şarj %, batarya sağlığı % |
| `POST /admin/invoices/generate?period=YYYY-MM` | Dönemin faturaları; aynı dönem ikinci kez `409 ALREADY_GENERATED` |
| `GET /admin/invoices`, `PATCH /admin/invoices/{number}` | Liste, ödendi işareti |
| `GET/POST /admin/fleet-expenses`, `PATCH /admin/fleet-expenses/{id}` | HGS, ceza, bakım, diğer (plakayla) |
| `GET /admin/requests`, `GET /admin/requests/{number}`, `POST /admin/requests/{number}/status` | Talepler (ADMIN.md §4) |

## 5. Veri modeli

| Model | Alanlar (özet) | Not | İş |
|---|---|---|---|
| `Company` (yeni) | ad, vergi dairesi, şehir, telefon, satış temsilcisi (JSON), `createdAt`, `updatedAt` | `User`'daki firma alanları migration'la taşınır; `GET /me` aynı kalır | V2-33 |
| `CompanyEmployee` (yeni) | şirket, ad, soyad, departman, sicil no, e-posta, telefon, `active` | Ehliyet bilgisi **saklanmaz** | V2-35 |
| `FleetContract` (yeni) | numara (`SZL-2026-00001`), şirket, ürün (`Product.slug`), başlangıç, bitiş, aylık bedel (kuruş), teslim şehri, durum (`ACTIVE`, `ENDED`) | CHECK `endAt > startAt`, bedel > 0 | V2-35 |
| `FleetVehicle` (yeni) | sözleşme, araç modeli, plaka (benzersiz, kiralık `Vehicle` plakalarıyla da çakışmaz), yıl, başlangıç km, bakım ve muayene tarihleri, durum (`ACTIVE`, `RETURNED`) | Kiralık `Vehicle`'dan ayrı (ADR-25) | V2-35 |
| `VehicleAssignment` (yeni) | filo aracı, personel, başlangıç, bitiş (boşsa açık), not | Araç başına tek açık zimmet (kısmi benzersiz indeks) | V2-35 |
| `VehicleReading` (yeni) | filo aracı, zaman, km, yakıt %, şarj %, batarya sağlığı %, kaynak (`MANUAL`, `SEED`) | Yüzdeler CHECK 0–100 | V2-35 |
| `FleetInvoice` (yeni) | numara (`FTR-2026-00001`), şirket, dönem, kesim ve son ödeme tarihi, satırlar (JSON), ara toplam, KDV, toplam, `paidAt` | "Gecikti" saklanmaz | V2-37 |
| `FleetExpense` (yeni) | şirket, filo aracı, tür (`HGS`, `PENALTY`, `MAINTENANCE`, `OTHER`), zaman, tutar, açıklama, yer, durum (`OPEN`, `REFLECTED`, `DISPUTED`) | Personel saklanmaz, zimmetten hesaplanır | V2-38 |
| `ServiceRequest`, `ServiceRequestEvent` (yeni) | ADR-31 | Türler: `ROADSIDE`, `REPLACEMENT_VEHICLE`, `MAINTENANCE`, `TRANSFER` (lastik ve muayene `MAINTENANCE` içinde işlem türüdür) | V2-41, V2-42 |
| `TrackingRoute` (yeni, seed) | şehir, ad, çoklu çizgi (JSON nokta listesi) | ADR-30 | V2-43 |
| `ChargingStation` (yeni, seed) | ad, şehir, enlem, boylam, soket türleri | Durum saklanmaz, simülasyon | V2-40 |

**Seed:** iki kurgusal şirket kurulur, böylece panel ilk açılışta dolu görünür:
- **"Örnek Lojistik A.Ş."**: Akıllı Kurumsal Filo sözleşmesi.
- **"Yeşil Enerji Ltd."**: Yeşil Filo + VIP Mobilite sözleşmeleri.
- Birer kullanıcı. Parola seed çalıştıranın ortam değişkeninden alınır, repoya yazılmaz.
- 12 filo aracı (4'ü elektrikli, 2'si hibrit), 15 personel.
- Son 3 ayın faturaları, 40 kadar HGS ve ceza kaydı, aylık okumalar.
- Her şehirde 2–3 rota, toplam ~30 şarj istasyonu.
- Seed canlıda tekrar çalışınca kopya üretmez ve var olan kaydın üzerine yazmaz (QUALITY §3.3).

## 6. Güvenlik ve KVKK

- **Şirket ayrımı API'dedir:** her sorgu `companyId` ile süzülür. Kimlikler uuid'dir; plaka ve numara adreste olsa da şirket süzgeci olmadan kayıt dönmez.
- **Personel kişisel veridir:** Filom'da yalnızca o şirketin kullanıcıları, Yönetim panelinde yalnızca yönetici görür. KVKK metnine "kurumsal müşterinin personel bilgileri, müşteri adına veri işleyen sıfatıyla" bölümü eklenir (G metni onaylar, V2-36).
- **Konum:** talepte "konumumu kullan" yalnızca kullanıcı düğmeye basınca tarayıcıdan alınır, talebin ayrıntısında saklanır, başka amaçla kullanılmaz. Canlı takip konumları kişisel veri değildir (simülasyon).
- **İşlem kaydı:** değiştiren her Filom isteği `AuditLog`'a yazılır (aktör müşteri kullanıcısı, `companyId` dolu). Yönetim panelinde görülür.
- Kurumsal hesapta Google ile giriş kapalıdır (403); kurumsal oturum 30 gün sürer.

## 7. Test

- **API:**
  - her `/fleet/*` ucu için "başka şirketin kaydı 404" ve "bireysel hesap 403";
  - zimmet çakışması `409`;
  - masrafın zimmet sınırında doğru kişiye eşlenmesi;
  - fatura üretiminin aynı dönemde reddi;
  - rapor toplamlarının fatura ve masraflarla tutması;
  - talep durum geçişleri (geçersiz geçiş `409`); VIP sözleşmesi olmayan şirkette `TRANSFER` 403;
  - simülasyonun aynı girdiye aynı çıktıyı vermesi;
  - seed'in iki kez çalışınca kopya üretmemesi.
- **Web** (`USE_MOCKS=1` ile e2e):
  - kurumsal giriş → Özet → araç ver → masraf personelde görünür → personele yansıt;
  - talep aç → durum zaman çizelgesi;
  - canlı takipte liste görünümü;
  - sözleşmesi olmayan şirkette boş durum;
  - bireysel hesapta `/filom` 404.
- **Canlı:** Faz 11 sonunda seed'li örnek şirketlerle bir tur (SPEC §6 madde 7–11).
