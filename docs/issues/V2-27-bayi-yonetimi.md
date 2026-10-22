# V2-27 · Bayi yönetimi: ekle, düzenle, kapat, yeniden aç

**Faz:** 4 · Katalog · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-24
**Belgeler:** ADMIN.md §3, §3.1, §4, §5 · SPEC §3.B

## Amaç
G'nin isteği: bayiyi panelden eklemek, düzenlemek ve kapatmak. Sitede bayi gösterilen her yer (Bayilerimiz, arama seçici, harita, JSON-LD, sitemap) buna anında uyar.

## Kapsam
- **Model (`Branch`):**
  - `kind` (`CITY`, `AIRPORT`), `closedAt`, `createdAt`, `updatedAt`;
  - mevcut bayilerin `kind` değeri migration'da addan doldurulur ("Havalimanı" geçenler `AIRPORT`);
  - web'deki addan çıkarım (`lib/branch-detail.ts:19-22`) kalkar.
- **API:**
  - `GET/POST /admin/branches`, `GET/PATCH /admin/branches/{id}`, `POST /admin/branches/{id}/close`, `POST /admin/branches/{id}/reopen`;
  - alanlar: ad, şehir (81 il), adres, enlem/boylam (Türkiye sınırları içinde), telefon, e-posta, tür, çalışma saatleri (hafta içi/cumartesi/pazar, `HH:MM-HH:MM` ya da kapalı).
- **Kapatma kuralı:**
  - gelecekte başlayan ya da biten rezervasyon, etkin tutma ya da etkin araç varsa `409 IN_USE`;
  - cevap sayıları taşır (`{ reservations, holds, vehicles }`), ekran bunları listeler.
- **Herkese açık uçlar:** `GET /branches` ve arama kapalı bayiyi döndürmez. Geçmiş rezervasyon cevapları bayi adını taşımaya devam eder.
- **Web önbelleği:** bayi verisi `branches` etiketiyle önbelleğe alınır; panel kaydı `revalidateTag('branches')` çağırır. Sitemap ve JSON-LD aynı veriden beslenir.
- **Ekran `/yonetim/bayiler`:**
  - liste (şehir süzgeci, açık/kapalı);
  - "Yeni bayi" formu: konum için harita seçimi (Maps anahtarı yoksa yalnız enlem/boylam alanları);
  - düzenleme;
  - kapatma ve yeniden açma onayı.

## Teknik notlar
- API: `apps/api/src/catalog/*`, yeni `src/admin/branches/`.
- Web: `lib/fleet-client.ts`, `lib/branch-detail.ts`, `components/branches/*`, `app/sitemap.ts`, `components/json-ld.tsx`.
- 81 il listesi v1'de var (kurumsal teklif teslim şehirleri); o kullanılır.

## Kabul kriterleri
- [ ] Yeni bayi Bayilerimiz'de, arama seçicide ve haritada hemen görünür (e2e mock + canlıda G denemesi).
- [ ] Gelecek rezervasyonu ya da aracı olan bayi kapatılamaz; ekranda nedenler listelenir (test + e2e).
- [ ] Kapatılan bayi sitenin hiçbir yerinde (arama, liste, harita, sitemap, JSON-LD) görünmez; geçmiş rezervasyonda adıyla durur.
- [ ] Yeniden açılan bayi geri gelir.
- [ ] Yetki, doğrulama ve çakışma testleri; işlem kaydı.
- [ ] 375/768/1280 ekran görüntüsü; çalışma saatleri formu klavyeyle kullanılabilir.

## Etiketler
`faz-4` `ozellik` `P2` `api` `web` `veritabani`
