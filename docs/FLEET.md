# Filom: kurumsal müşteri filo paneli (tasarım)

> Durum: **Taslak v0.1** · 20 Ekim 2026 · Sahipler: Berkay (backend), G (frontend)
> Kapsam kararı SPEC §2.12'de (v0.11), mimari karar ARCHITECTURE ADR-25'te, iş sırası [ROADMAP.md](ROADMAP.md)'de. Novera'nın kendi iç paneli ayrı belgede: [ADMIN.md](ADMIN.md).
> Uçların kesin biçimi her işin PR'ında `docs/api/openapi.yaml`'a yazılır; çelişki olursa sözleşme kazanır.

## 1. Ne bu

**Filom**, uzun dönem filo kiralayan kurumsal müşterinin kendi filosunu yönettiği paneldir. SPEC Ek A'da "Novera Admin Paneli" diye satılan ürünün çalışan hâlidir: araçların hangi personele zimmetli olduğu, sözleşme süreleri, faturalar, HGS ve ceza masrafları, Yeşil Filo için batarya ve karbon raporu.

Sitede iki panel olur, adları ekranda karışmasın diye farklıdır:

| Panel | Kim kullanır | Adres | Belge |
|---|---|---|---|
| **Yönetim paneli** | Novera çalışanı (`ADMIN` rolü) | `/yonetim` · `/en/admin` | ADMIN.md |
| **Filom** | Kurumsal müşterinin filo yöneticisi | `/filom` · `/en/my-fleet` | Bu belge |

Ürün sayfalarındaki "Novera Admin Paneli" pazarlama adı olarak kalır; ekranda müşteri panelin adını **Filom** olarak görür.

### İki panel nasıl birlikte çalışır

Gerçek bir filo şirketinde sözleşme, araç teslimi, fatura ve trafik cezası bilgisi Novera'nın sistemlerinden gelir. Bizde bu verileri **Novera çalışanı Yönetim panelinden girer** (ya da seed'le gelir); müşteri Filom'da görür ve kendi tarafını yönetir:

| Novera girer (Yönetim paneli) | Müşteri yönetir (Filom) |
|---|---|
| Şirket, şirketin kullanıcıları (davet), sözleşmeler | Personel listesi |
| Filo araçları (plaka, model, sözleşme), kilometre ve batarya okumaları | Zimmet: hangi araç kimde, geçmişi |
| Aylık faturalar (sözleşmelerden tek düğmeyle oluşur), ödendi işareti | Faturaları görür |
| HGS geçişi, trafik cezası, bakım masrafı kayıtları | Masrafı personele yansıtır, itiraz eder |
| | Raporlar, sözleşme yenileme talebi |

### v1'de olmayan (SPEC §3'te kalır)

Canlı GPS ve harita, telematik cihaz bağlantısı (okumalar elle ya da seed'le girilir), Novera Driver App, SOS, gerçek e-fatura ve ödeme (faturalar kurgusaldır, ekranda "örnek fatura, yasal belge değildir" yazar), banka/HGS sistemlerinden otomatik veri, müşterinin siteden araç eklemesi ya da sözleşme imzalaması, şirket içinde birden fazla rol (v1'de şirketin tüm kullanıcıları filo yöneticisidir).

## 2. Kim girer

- **Kurumsal hesap** (`accountType = CORPORATE`) bir **şirkete** bağlıdır (`User.companyId`). Bir şirketin birden fazla kullanıcısı olabilir; hepsi aynı filoyu görür.
- Hesabı Novera açar: Yönetim panelinde şirketin sayfasından "Kullanıcı davet et" (ADMIN.md §4, kurumsal hesap açma). Kişi e-postadaki bağlantıyla şifresini belirler ve `/giris?tip=kurumsal`'dan girer.
- **Filom'u yalnızca filo sözleşmesi olan şirket görür.** Sözleşmesi olmayan kurumsal hesapta bugünkü basit kurumsal profil (firma bilgileri, teklif talepleri) kalır; Filom bağlantısı görünmez, `/filom` "Filonuz henüz yok, teklif alın" boş durumunu gösterir.
- **Veri ayrımı:** her `/fleet/*` ucu oturumdaki kullanıcının şirketiyle süzer. Başka şirketin kaydı **404** döner (var olduğu belli edilmez). Bu, her uç için zorunlu bir testtir (§7).

## 3. Ekranlar

Adres TR `/filom/...`, EN `/en/my-fleet/...`. Hepsi `noindex`, giriş gerektirir, navbar'ın hesap menüsünde ve kurumsal profilde "Filom" bağlantısı. Yerleşim Yönetim paneliyle aynı ortak bileşenleri kullanır (tablo, süzgeç, form, onay penceresi; ADMIN.md §3, Y82) ama sitenin müşteri yüzüdür: başlıkta şirket adı, sitenin navbar ve footer'ı yerinde.

| Ekran | Adres | İçerik |
|---|---|---|
| Özet | `/filom` | Araç sayısı (zimmetli / boşta), bu ayın faturası ve ödenmemiş toplam, açık masraflar (personele yansıtılmamış ceza ve HGS), 60 gün içinde biten sözleşmeler, bakım ya da muayenesi yaklaşan araçlar. Her kart ilgili listeye süzgeçli gider |
| Araçlar | `/filom/araclar`, `/filom/araclar/:plaka` | Liste: plaka, model, sözleşme, kimde, son kilometre, durum; süzgeç (zimmetli/boşta, model, sözleşme). Detay: araç bilgisi, şu anki zimmet ve geçmişi, son okumalar (km, yakıt ya da şarj, batarya sağlığı), bu aracın masrafları, bakım ve muayene tarihleri |
| Personel | `/filom/personel` | Ad, soyad, departman, sicil no, e-posta, telefon; ekle, düzenle, pasifleştir (zimmeti varsa önce zimmet kapanır) |
| Zimmet | araç detayında ve `/filom/zimmet` | Aracı personele ver (tarih), geri al; bir aracın aynı anda tek açık zimmeti olur. Geçmiş tablo |
| Sözleşmeler | `/filom/sozlesmeler`, `.../:numara` | Ürün (ör. Akıllı Kurumsal Filo), başlangıç-bitiş, aylık bedel, araç sayısı, kalan gün; "Yenileme talebi gönder" (kurumsal teklif talebi oluşturur, Yönetim panelinde Teklifler'e düşer) |
| Faturalar | `/filom/faturalar`, `.../:numara` | Dönem, tutar, son ödeme, durum (Ödendi, Bekliyor, Gecikti); detayda sözleşme bazında satırlar ve KDV. "Örnek fatura" notu; indirme v1'de yok, sayfa yazdırılabilir |
| Masraflar | `/filom/masraflar` | HGS geçişi, trafik cezası, bakım, diğer; tarih, araç, tutar, **o anda zimmetli personel** (otomatik), durum (Açık, Personele yansıtıldı, İtiraz edildi). Toplu "personele yansıt"; süzgeç (tür, durum, araç, personel, tarih) |
| Raporlar | `/filom/raporlar` | Seçilen dönemde araç başına, departman başına ve aylık toplam maliyet (fatura payı + masraflar); kilometre; Yeşil Filo araçları için karbon tasarrufu ve batarya sağlığı. Tablolar ve sade çubuk grafikler; her grafiğin tablo karşılığı da vardır (erişilebilirlik) |

### Davranış kuralları

- Tutarlar TRY'dir (filo sözleşmeleri TL); ekranda kullanıcının para birimi tercihinden bağımsız ₺ gösterilir, "Tutarlar TL" notuyla.
- Tarihler İstanbul saatiyle (ADR-16).
- Masrafın personeli: masrafın `occurredAt` anında aracın açık zimmeti kimdeyse odur. Zimmet sonradan geriye dönük değiştirilirse eşleme yeniden hesaplanır (yalnızca durumu Açık olanlarda).
- Rapor sayıları kuruşa kadar faturalar ve masraflarla tutar (test).
- Karbon tasarrufu **örnek hesaptır** ve ekranda öyle yazar: aracın kilometresi × (benzinli eşdeğer araç emisyonu − aracın emisyonu). Katsayılar tek yerde (`fleet-report.ts`) ve belgede: benzinli eşdeğer 0,170 kg CO₂/km, hibrit 0,105, elektrikli 0,045 (şebeke payı). Gerçek bir ölçüm iddiası yoktur.

## 4. API

### Müşteri uçları (`/fleet/*`)

`CompanyGuard` arkasında: oturum + `accountType = CORPORATE` + `companyId` dolu. Sözleşmesi olmayan şirkette uçlar boş liste döner. Listeler ADR-24'teki gibi sayfalıdır.

| Uç | Ne |
|---|---|
| `GET /fleet/summary` | Özet kartlarının sayıları |
| `GET /fleet/vehicles`, `GET /fleet/vehicles/{plate}` | Araçlar ve detay (zimmet geçmişi, son okumalar, masraf özeti) |
| `GET/POST /fleet/employees`, `PATCH /fleet/employees/{id}` | Personel; silme yok, `active: false` |
| `GET /fleet/assignments`, `POST /fleet/assignments`, `POST /fleet/assignments/{id}/end` | Zimmet; aracın açık zimmeti varken yenisi `409 VEHICLE_ASSIGNED` |
| `GET /fleet/contracts`, `GET /fleet/contracts/{number}`, `POST /fleet/contracts/{number}/renewal-request` | Sözleşmeler ve yenileme talebi (bir `QuoteRequest` açar, ürün ve araç sayısı doldurulmuş) |
| `GET /fleet/invoices`, `GET /fleet/invoices/{number}` | Faturalar |
| `GET /fleet/expenses`, `PATCH /fleet/expenses/{id}`, `POST /fleet/expenses/reflect` | Masraflar; durum değiştirme (Açık ↔ İtiraz edildi, Açık → Personele yansıtıldı); toplu yansıtma |
| `GET /fleet/reports?from=&to=` | Dönem raporu (araç, departman, ay kırılımı; karbon ve batarya) |

### Yönetim uçları (`/admin/companies/*`, ADR-24 kuralları)

| Uç | Ne |
|---|---|
| `GET/POST /admin/companies`, `GET/PATCH /admin/companies/{id}` | Şirket (ad, vergi dairesi, şehir, telefon, satış temsilcisi) |
| `POST /admin/companies/{id}/users` | Kurumsal kullanıcı davet et (parolasız hesap + şifre belirleme e-postası; ADMIN.md §4) |
| `GET/POST /admin/companies/{id}/contracts`, `PATCH /admin/contracts/{number}` | Sözleşme (ürün, başlangıç, bitiş, aylık bedel, durum) |
| `GET/POST /admin/contracts/{number}/vehicles`, `PATCH /admin/fleet-vehicles/{id}` | Filo aracı (model, plaka, yıl, başlangıç km, bakım ve muayene tarihleri, iade) |
| `POST /admin/fleet-vehicles/{id}/readings` | Kilometre, yakıt/şarj, batarya sağlığı okuması |
| `POST /admin/invoices/generate?period=2026-11` | O dönemin faturalarını tüm etkin sözleşmelerden oluşturur; aynı dönem ikinci kez `409 ALREADY_GENERATED` |
| `GET /admin/invoices`, `PATCH /admin/invoices/{number}` | Liste, ödendi işareti |
| `GET/POST /admin/fleet-expenses`, `PATCH /admin/fleet-expenses/{id}` | HGS, ceza, bakım masrafı girişi (araç plakasıyla) |

## 5. Veri modeli

| Model | Alanlar (özet) | Not |
|---|---|---|
| `Company` (yeni) | ad, vergi dairesi, şehir, telefon, satış temsilcisi (JSON), `createdAt`, `updatedAt` | Bugün `User` üzerindeki firma alanları migration'la buraya taşınır; `GET /me` aynı alanları şirketten doldurur (sözleşme değişmez) |
| `User` | `companyId String?` | Yalnızca kurumsal hesapta dolu |
| `CompanyEmployee` (yeni) | şirket, ad, soyad, departman, sicil no, e-posta, telefon, `active` | Kişi verisi en az tutulur; ehliyet bilgisi **saklanmaz** (SPEC §2.10 ilkesi) |
| `FleetContract` (yeni) | numara (`SZL-2026-00001`), şirket, ürün, başlangıç, bitiş, aylık bedel (kuruş), durum (`ACTIVE`, `ENDED`) | |
| `FleetVehicle` (yeni) | sözleşme, araç modeli, plaka (benzersiz), yıl, başlangıç km, bakım ve muayene tarihleri, durum (`ACTIVE`, `RETURNED`) | Kiralık `Vehicle` tablosundan **ayrıdır**: filo aracı bayide durmaz, aramada çıkmaz |
| `VehicleAssignment` (yeni) | filo aracı, personel, başlangıç, bitiş (boşsa açık), not | Araç başına tek açık zimmet (kısmi benzersiz indeks) |
| `VehicleReading` (yeni) | filo aracı, zaman, km, yakıt %, şarj %, batarya sağlığı %, kaynak (`MANUAL`, `SEED`) | |
| `FleetInvoice` (yeni) | numara (`FTR-2026-00001`), şirket, dönem (`2026-11`), kesim ve son ödeme tarihi, satırlar (JSON: sözleşme, açıklama, tutar), ara toplam, KDV, toplam, `paidAt` | "Gecikti" saklanmaz, son ödeme tarihinden hesaplanır |
| `FleetExpense` (yeni) | şirket, filo aracı, tür (`HGS`, `PENALTY`, `MAINTENANCE`, `OTHER`), zaman, tutar, açıklama, yer, eşleşen personel, durum (`OPEN`, `REFLECTED`, `DISPUTED`) | |

**Seed:** "Örnek Lojistik A.Ş." ve "Yeşil Enerji Ltd." adlı iki kurgusal şirket, birer kullanıcı (parolası seed çalıştıran kişiye ortam değişkeninden, repoya yazılmaz), 2 sözleşme, 12 filo aracı (biri elektrikli ağırlıklı), 15 personel, son 3 ayın faturaları, 40 kadar HGS ve ceza kaydı, aylık okumalar. Böylece panel ilk açılışta dolu görünür.

## 6. Güvenlik ve KVKK

- **Şirket ayrımı API'dedir**; her sorgu `companyId` ile süzülür ve başka şirketin kaydı 404'tür. Kimlikler tahmin edilemez (uuid); plaka ve numara adreste olsa da şirket süzgeci olmadan kayıt dönmez.
- Personel kişisel veridir: Filom'da yalnızca o şirketin kullanıcıları, Yönetim panelinde yalnızca yönetici görür. KVKK aydınlatma metnine "kurumsal müşterinin personel bilgileri, müşteri adına veri işleyen sıfatıyla" bölümü eklenir (G, metin).
- Değiştiren her Filom isteği şirket bazlı işlem kaydına yazılır (ADMIN.md §5'teki `AdminAuditLog` ile aynı tablo, `actor` müşteri kullanıcısı ve `companyId` dolu); Yönetim panelinde görülür, Filom'da v1'de gösterilmez.
- Kurumsal hesapta Google ile giriş zaten kapalı (403); kurumsal oturum 30 gün kalır (müşteri kullanıcısı).

## 7. Test

- **BE:** her `/fleet/*` ucu için "başka şirketin kaydı 404" ve "bireysel hesap 403" testleri; zimmet çakışması (`409 VEHICLE_ASSIGNED`); masrafın zimmetli personele eşlenmesi (zimmet değişimi sınırında); fatura oluşturmanın aynı dönemde ikinci kez reddi; rapor toplamlarının faturalar ve masraflarla tutması; seed'in iki kez çalışınca kopya üretmemesi.
- **FE:** `USE_MOCKS=1` ile e2e: kurumsal giriş → Filom Özet → araç ver → masraf personelde görünür → personele yansıt; sözleşmesi olmayan şirkette boş durum; bireysel hesapta `/filom` giriş/404 davranışı.
- **Canlı:** Faz 8 sonunda seed'li örnek şirketle bir tur.
