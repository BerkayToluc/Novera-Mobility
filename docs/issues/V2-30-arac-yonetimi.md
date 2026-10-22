# V2-30 · Araç yönetimi (ekle, taşı, kaldır) ve ek hizmetler

**Faz:** 4 · Katalog · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-27, V2-29
**Belgeler:** ADMIN.md §3.1, §4

## Amaç
G'nin isteği: kiralık filoya fiziksel araç eklemek ve çıkarmak. Ayrıca ek hizmet fiyatlarını panelden düzenlemek.

## Kapsam
- **API:**
  - `GET/POST /admin/vehicles`, `PATCH /admin/vehicles/{id}` (bayi, `active`);
  - liste süzgeçleri: model, bayi, durum, plaka araması.
- **Kurallar:**
  - plaka Türk plaka biçiminde, büyük harfe çevrilir ve benzersizdir (filo araçlarıyla da çakışmaz; V2-35'ten sonra denetlenir);
  - yıl 2015 ile bu yıl + 1 arasında;
  - kapalı bayiye ya da kaldırılmış modele araç eklenemez (`422`);
  - kaldırma (`active = false`) ve bayi değişikliği, gelecek rezervasyonu ya da etkin tutması olan araçta `409 IN_USE`.
- **Ek hizmetler:** `GET /admin/extras`, `PATCH /admin/extras/{slug}` ile ad (TR/EN) ve fiyat düzenlenir. Yeni ek hizmet eklenmez.
- **Ekranlar:** `/yonetim/araclar` (liste, "Yeni araç", bayi değiştirme, kaldırma ve geri alma onayı) ve `/yonetim/ek-hizmetler`.
- **Önbellek:** arama müsaitliği önbelleğe alınmaz; `extras` etiketi temizlenir.

## Kabul kriterleri
- [ ] Yeni araç, bayisinde ve uygun tarihlerde aramada müsait görünür (e2e mock + canlı G denemesi).
- [ ] Gelecek rezervasyonlu araç kaldırılamaz ve taşınamaz (test).
- [ ] Aynı plaka ikinci kez eklenemez.
- [ ] Ek hizmet fiyat değişikliği yeni özet hesabında görünür, eski rezervasyonda değişmez.
- [ ] Yetki, doğrulama ve çakışma testleri; işlem kaydı; 375/1280 ekran görüntüsü.

## Etiketler
`faz-4` `ozellik` `P2` `api` `web`
