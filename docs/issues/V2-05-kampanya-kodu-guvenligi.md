# V2-05 · Kampanya kodu güvenliği ve canlıda güvenli seed

**Faz:** 1 · Acil güvenlik · **Öncelik:** P0 · **Boyut:** M · **Bağımlı:** V2-03
**Bulgular:** QUALITY G-04, G-05

## Amaç
Bugün üç sorun var:
- Kampanya kodları girişsiz ve sınırsız denenebiliyor.
- Kodlarda kullanım tavanı yok.
- Seed canlıda her çalıştığında kodları süresiz yeniden açıyor ve canlı kurların üzerine yazıyor.

## Kapsam
- **Deneme sınırı:**
  - `POST /reservations/price` gövdesinde `promoCode` varsa istemci başına 10 dakikada 10 istek; aşılınca `429`.
  - Cevap, olmayan kodu süresi dolmuş ya da tavanı dolmuş koddan ayırt ettirmez: `promo.applied: false` döner, `promo.reason` dönmez.
- **Model (`PromoCode`):**
  - `maxRedemptions Int?` (boşsa sınırsız);
  - `oncePerUser Boolean @default(true)`;
  - `createdAt`, `updatedAt`;
  - CHECK `percent BETWEEN 1 AND 90`.
- **Rezervasyon anında:**
  - Kod satırı kilitlenir; kullanım sayısı (iptal edilmemiş rezervasyonlar) ve kişinin kodu daha önce kullanıp kullanmadığı denetlenir.
  - Tavan doluysa `422 CODE_EXHAUSTED`, kişi zaten kullanmışsa `422 CODE_ALREADY_USED`.
  - İptal edilen rezervasyonun kodu kişiye geri döner.
- **Seed:** canlıda yalnızca **eksik** referans verisini ekler.
  - Var olan kodun durumuna, tarihlerine ve yüzdesine, var olan kurlara ve fiyatlara dokunmaz.
  - Örnek kodlar (`NOVERA10`, `HOSGELDIN`) yalnızca `SEED_DEMO=1` iken ve yoksa eklenir; 30 gün geçerli olur.
  - DEPLOY.md §2 buna göre güncellenir.
- **Web:** yeni hata kodlarının metinleri (TR/EN) özet sayfasında kod kutusunun altında gösterilir.

## Teknik notlar
- API: `apps/api/src/reservations/pricing.service.ts:236-239`, `reservations.service.ts`, `prisma/schema.prisma:308-315`, `prisma/seed.ts:87-101`.
- Web: `lib/promo-codes.ts`, `components/booking/*`.
- `openapi.yaml` güncellenir.

## Kabul kriterleri
- [ ] Kodlu fiyat isteği 10 dakikada 10 sınırını aşınca `429` döner.
- [ ] Tavanı 1 olan koda aynı anda iki rezervasyon gelince biri başarılı olur, diğeri `CODE_EXHAUSTED` alır (entegrasyon testi).
- [ ] Aynı kişi kodu ikinci kez kullanınca `CODE_ALREADY_USED` alır; rezervasyonu iptal edince kodu yeniden kullanabilir.
- [ ] Seed iki kez çalıştırılınca kodların durumu ve kurlar değişmez (test).
- [ ] Migration canlıda uygulandı; Berkay mevcut kodların durumunu G'ye bildirdi.
- [ ] QUALITY'de G-04 ve G-05 güncel.

## Etiketler
`faz-1` `guvenlik` `P0` `api` `web` `veritabani`
