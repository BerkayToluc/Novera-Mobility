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
- [ ] VIP sözleşmesi olmayan şirkette `TRANSFER` 403 ve seçenek yok (test + e2e).
- [ ] "Şoför atandı" adımına `assignee` olmadan geçilemez (test).
- [ ] e2e: Yeşil Enerji Ltd. (VIP sözleşmeli) ile transfer talebi → panelde şoför ata → Filom'da görünür.
- [ ] 375/1280 ekran görüntüsü; axe temiz.

## Etiketler
`faz-10` `ozellik` `P2` `api` `web`
