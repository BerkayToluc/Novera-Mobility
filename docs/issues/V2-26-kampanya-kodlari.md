# V2-26 · Kampanya kodları yönetimi

**Faz:** 4 · Katalog · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-24, V2-05
**Belgeler:** ADMIN.md §3, §3.1, §4

## Amaç
G'nin ilk isteği: kampanya kodlarını koda ya da veritabanına dokunmadan eklemek, düzenlemek ve kaldırmak.

## Kapsam
- **API:**
  - `GET/POST /admin/promo-codes`, `GET/PATCH /admin/promo-codes/{code}`;
  - `DELETE /admin/promo-codes/{code}` yalnızca hiç kullanılmamış kodda çalışır; kullanılmışsa `409 IN_USE`, kod pasifleştirilir.
  - Liste sayfalı, durum süzgeçli (etkin, pasif, süresi dolmuş, tavanı dolmuş); her satırda kullanım sayısı.
- **Kurallar (ADMIN.md §3.1):**
  - kod büyük harf, 3–20 karakter ve benzersiz;
  - yüzde 1–90;
  - `validUntil > validFrom`;
  - tavan ≥ mevcut kullanım;
  - kişi başı tek kullanım anahtarı;
  - `STALE_WRITE`.
- **Ekran `/yonetim/kampanya-kodlari`:** liste, "Yeni kod" formu, düzenleme, pasifleştirme ve silme onayı.
- Her değişiklik işlem kaydına yazılır.

## Kabul kriterleri
- [ ] Panelde açılan kod özet sayfasında indirim satırını üretir (e2e mock + canlıda G'nin bir denemesi).
- [ ] Pasif ya da süresi dolmuş kod özet sayfasında uygulanmaz.
- [ ] Kullanılmış kod silinemez, pasifleşir (test).
- [ ] Yetki testleri 401/403; doğrulama 422; `STALE_WRITE`.
- [ ] 375/1280 ekran görüntüsü; axe temiz.

## Etiketler
`faz-4` `ozellik` `P2` `api` `web`
