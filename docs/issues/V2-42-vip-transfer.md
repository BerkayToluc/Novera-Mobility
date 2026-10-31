# V2-42 · VIP transfer talebi

**Faz:** 10 · Talepler · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-41
**Belgeler:** SPEC §3.D · FLEET.md §3.1 · ARCHITECTURE ADR-31

## Amaç
VIP Mobilite'deki "Hızlı Transfer ve Şoför Koordinasyonu" ve "uçuş takibi" vaadini, şoförlü transfer talebi olarak çalıştırmak.

## Kapsam
- **Yeni talep türü `TRANSFER`:**
  - `details` alanları: yolcu adı, yolcu sayısı (1–7), uçuş numarası (isteğe bağlı, biçim `TK1234`), karşılama yeri (havalimanı listesinden ya da adres), karşılama tarih-saati (en az 2 saat sonrası), varış adresi, not;
  - `fleetVehicleId` yok.
- **Erişim:** yalnızca etkin `vip-mobilite` sözleşmesi olan şirkette açılabilir; değilse `403 FORBIDDEN`. Filom'daki tür seçiminde başka şirkette seçenek görünmez.
- **Durum akışı:** Alındı → Şoför atandı → Karşılandı → Tamamlandı (ya da İptal). "Şoför atandı" adımında `assignee` zorunludur (şoför adı, telefonu, araç; serbest metin).
- **Uçuş takibi:** gerçek bir servise bağlanmaz. Uçuş numarası gösterilir; ekranda "uçuş durumu operasyon masası tarafından izlenir" notu bulunur.
- **Ekranlar:** Filom talep formu ve detayı; panelde talepler listesinde tür süzgeci.

## Kabul kriterleri
- [x] VIP sözleşmesi olmayan şirkette `TRANSFER` 403 ve seçenek yok (test + e2e). _`fleet-requests.integration.spec.ts`: sözleşmesi olmayan şirket hangi gövdeyi gönderirse göndersin 403 `FORBIDDEN`, bitmiş VIP sözleşmesi de saymaz, hiçbir şey yazılmaz. e2e: sözleşmesiz örnek şirkette formda yalnız üç seçenek ve listede "VIP transfer" zinciri yok; yönetici VIP sözleşmesi açınca belirir._
- [x] "Şoför atandı" adımına `assignee` olmadan geçilemez (test). _Entegrasyon testi: `DRIVER_ASSIGNED`, `MET`, `COMPLETED` şoförsüz `422 assignee: REQUIRED` (boşluk da sayılmaz), hiçbir olay yazılmaz; şoför bir kez yazılınca sonraki adımlar onu korur, `MET`'te silmeye çalışmak reddedilir, iptal şoförsüz geçer. e2e: panelde şoförsüz kayıt hata verir._
- [x] e2e: Yeşil Enerji Ltd. (VIP sözleşmeli) ile transfer talebi → panelde şoför ata → Filom'da görünür. _Yeşil Enerji Ltd. seed şirketidir, sample modda yoktur; e2e aynı akışı sample şirketle koşar: yönetici VIP Mobilite sözleşmesi açar → Filom'da transfer açılır (uçuş notu dahil) → panelde şoför atanır → Filom'da şoför ve adım görünür. Seed şirketiyle gerçek API'ye karşı tarayıcıda denenmedi._
- [x] 375/1280 ekran görüntüsü; axe temiz. _Ekran görüntüsü artık istenmiyor; e2e mobil 375 ve masaüstü 1280'de koşar, her test axe ile biter._

## Etiketler
`faz-10` `ozellik` `P2` `api` `web`
