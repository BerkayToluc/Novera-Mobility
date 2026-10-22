# V2-29 · Araç modeli yönetimi: ekle (fotoğraflı), düzenle, kaldır

**Faz:** 4 · Katalog · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-28
**Belgeler:** ADMIN.md §3.1, §4, §5

## Amaç
G'nin isteği: yeni araç modelini fotoğrafıyla panelden eklemek, var olanı düzenlemek ve kaldırmak.

## Kapsam
- **Model (`VehicleModel`):** `retiredAt`, `createdAt`, `updatedAt`.
- **API:**
  - `GET/POST /admin/vehicle-models`, `GET/PATCH /admin/vehicle-models/{slug}`, `POST .../retire`, `POST .../restore`.
  - **Alanlar:** marka, model, slug (addan önerilir, benzersiz, oluşturulduktan sonra değişmez), sınıf (mevcut sınıflar), yakıt, vites, koltuk, bagaj, tüketim ve birimi (yakıta göre: L ya da kWh/100 km), günlük fiyat (TRY, > 0), açıklama (TR/EN), `imageUrl`.
  - **Kaldırma:** gelecek rezervasyonu ya da etkin tutması varsa `409 IN_USE`. Kaldırılan modelin etkin araçları da pasifleşir (aynı işlemde).
- **Herkese açık uçlar:** `GET /vehicle-models` ve arama kaldırılmış modeli döndürmez. Geçmiş rezervasyonlar modeli göstermeye devam eder. `?arac=<kaldırılmış slug>` pencereyi açmaz, sayfa normal açılır.
- **Fiyat:** değişiklik yalnızca yeni fiyat hesaplarını etkiler; var olan rezervasyonun `price` alanı değişmez.
- **Web önbelleği:** `vehicle-models` etiketi.
- **Ekran `/yonetim/modeller`:** liste (sınıf, yakıt, fiyat, araç sayısı, durum), "Yeni model" formu (fotoğraf yükleme V2-28), düzenleme, kaldırma ve geri alma onayı.
- **Fotoğrafsız model:** sitede yer tutucu gösterir (bugünkü davranış).

## Kabul kriterleri
- [ ] Yeni model ana sayfa filo bölümünde (kendi sınıf çipinde) ve `?arac=` penceresinde görünür. Araç eklenince aramada da çıkar (V2-30 ile birlikte e2e).
- [ ] Fiyat değişikliği var olan rezervasyonun tutarını değiştirmez (entegrasyon testi).
- [ ] Gelecek rezervasyonlu model kaldırılamaz; kaldırılan model sitede görünmez.
- [ ] Slug değiştirilemez (PATCH'te alan reddedilir).
- [ ] Yetki, doğrulama ve çakışma testleri; işlem kaydı; 375/1280 ekran görüntüsü.

## Etiketler
`faz-4` `ozellik` `P2` `api` `web` `veritabani`
