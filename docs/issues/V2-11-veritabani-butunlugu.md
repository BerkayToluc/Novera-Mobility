# V2-11 · Veritabanı bütünlüğü ve migration düzeni

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** L · **Bağımlı:** V2-07
**Bulgular:** QUALITY V-01, V-02, V-03, V-04, V-05, V-08, G-17, T-04 (kayma kontrolü)

## Amaç
İş kurallarını yalnızca kodda değil veritabanında da korumak, panelin çakışma denetimi (`updatedAt`) için zemini hazırlamak ve migration'ları şemayla birebir hale getirmek.

## Kapsam
- **Migration kayması:**
  - Yerel geliştirme veritabanı sıfırdan kurulur, `prisma migrate diff` ile şema ve migration farkı ölçülür.
  - Fark varsa düzeltici bir migration yazılır. `20261017102847`'deki elle değiştirilmiş DROP açıklanır.
  - Canlı Neon'da da `migrate diff` çalıştırılır ve sonuç PR'a yazılır (kişisel veri yok).
- **FK:** `Hold.pickupBranchId` ve `returnBranchId` → `Branch`.
- **CHECK** (ham SQL migration):
  - `Reservation` ve `Hold` için `endAt > startAt`;
  - tutarlar ≥ 0;
  - `ReservationExtra.quantity >= 1`;
  - `PromoCode.percent` (V2-05'te yapılmadıysa).
- **İndeksler:**
  - `Reservation(pickupBranchId)`, `Reservation(returnBranchId)`;
  - `ReservationExtra(extraId)`, `QuoteRequest(productId)`;
  - `Reservation(userId, startAt)`.
- **Zaman damgaları:**
  - `Reservation` için `updatedAt` ve `cancelledAt`;
  - `QuoteRequest` için `updatedAt`;
  - `Branch`, `VehicleModel`, `Vehicle`, `Extra`, `FaqItem` için `createdAt` ve `updatedAt`.
  - Mevcut satırlar migration'da `now()` ile doldurulur.
- **Rezervasyon numarası:** "en büyük + 1" yerine Postgres sequence. Numara biçimi aynı kalır.
- **Yorum ve adlandırma:** eskimiş yorumlar düzeltilir (`schema.prisma:148`, `:311`). `FaqTopic` değerlerinin büyük harfe çevrilip çevrilmeyeceğine bakılır: sözleşmeyi bozuyorsa yalnızca yorum eklenir, karar PR'a yazılır.
- **CI:** `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` adımı (shadow veritabanı CI'daki Postgres servisi).

## Kapsam dışı
Puan harcamasının defter tablosuna taşınması (V-08'in ilk yarısı). Riskli bir yeniden yapılanmadır; PR'da "kabul edildi" gerekçesiyle kaydedilir.

## Teknik notlar
- Dosyalar: `apps/api/prisma/schema.prisma`, `prisma/migrations/`, `reservations/reservations.service.ts:124-131`, `.github/workflows/ci.yml`.
- **Canlıya uygulamadan önce yedek alınır** (WORKFLOW.md §4).

## Kabul kriterleri
- [ ] `prisma migrate diff` CI'da temiz; bilerek bozulan şemada kırmızı.
- [ ] Kısıt ihlali testleri: `endAt <= startAt` olan satır veritabanına yazılamaz; negatif tutar yazılamaz.
- [ ] Rezervasyonlarım sorgusu yeni indeksi kullanıyor (`EXPLAIN` çıktısı PR'da).
- [ ] Rezervasyon numarası eşzamanlı 20 istekte benzersiz.
- [ ] Canlı migration yedekli uygulandı (Berkay issue'ya yazar).
- [ ] QUALITY'de V-01–V-05, V-08, G-17 ve T-04 güncel.

## Etiketler
`faz-2` `temel` `veritabani` `P1` `api` `ci`
