# V2-46 · Son kabul ve v2.0.0

**Faz:** 12 · Yayın · **Öncelik:** P0 · **Boyut:** S · **Bağımlı:** V2-01 – V2-45 (ya da G'nin v2.1'e kaydırdıkları)

## Amaç
v2'nin bittiğini canlıda kanıtlamak ve belgeleri son duruma getirmek.

## Kapsam
- **SPEC §6 kabul akışları** (1–11), canlıda, önce 375 px mobil, sonra 1280 px ve yalnızca klavyeyle. G yürütür, Berkay örnek veriyi hazırlar.
- **QUALITY kapanışı:** açık bulgu kalmadı ya da hepsi gerekçeyle "kabul edildi".
- **Belgeler:**
  - ROADMAP §1 "Neredeyiz" güncellenir;
  - BACKLOG eşleme tablosu tam;
  - SPEC sürüm notu yazılır;
  - v2.1'e kalanlar listelenir.
- **Etiket:** `main`'e `v2.0.0` atılır.

## Kabul kriterleri
- [ ] SPEC §6'nın 11 maddesi bu issue'da yorum olarak işaretli (her biri için kısa not).
- [ ] QUALITY'de Açık bulgu yok.
- [ ] Belgeler güncel; `v2.0.0` etiketi var.

## Hazırlık (V2-46 PR'ı)
PR kabul turunu yürütmek için gerekenleri hazırlar: aşağıdaki akış listesi, örnek veri komutu ve belgelerin son hali. **Kabul kriterleri işaretlenmedi**: turu G canlıda yürütür, her akış için GitHub issue'sunda (#336) kısa not düşer. Kapanış kararları:
- **QUALITY:** tek açık bulgu G-21 (Düşük) gerekçesiyle "Kabul edildi" yazıldı; **Berkay onaylar** (onaylamazsa düzeltmek küçük bir iştir, ROADMAP §7). Diğer bulguların hepsi `Düzeltildi` ya da gerekçeyle `Kabul edildi`.
- **v2.1'e kalanlar:** ROADMAP.md §7.
- **`v2.0.0` etiketi:** tur bitince, `main` güncelken: `git tag -a v2.0.0 -m "v2.0.0"` ve `git push origin v2.0.0` (ya da GitHub → Releases → Draft a new release → tag `v2.0.0`, hedef `main`). Etiket yalnız G'nin turu bitirdiğini söylemesinden sonra atılır.

### Örnek veri (Berkay hazırlar)
Akışların çoğu örnek filo müşterisi ister. Tam `db:seed` canlıda bayi, model ve araç düzenlemelerini geri yazar; bunun yerine yalnız örnek filoyu ve simülasyon verisini ekleyen komutlar kullanılır (yalnız eksikleri ekler, tekrar çalıştırmak kopya üretmez). Bağlantı `Read-Host` ile girilir, parola repoya yazılmaz:

```powershell
$env:DATABASE_URL = Read-Host "Neon baglanti dizesi"
```

```powershell
$env:FLEET_SEED_PASSWORD = Read-Host "Ornek kullanicilarin parolasi"
```

```powershell
pnpm --filter @novera/api db:seed:fleet
```

```powershell
pnpm --filter @novera/api db:seed:simulation
```

```powershell
Remove-Item Env:DATABASE_URL, Env:FLEET_SEED_PASSWORD
```

Bu, **Örnek Lojistik A.Ş.** (Akıllı Kurumsal Filo, personel, zimmet, okuma, fatura ve masraf) ve **Yeşil Enerji Ltd.** (elektrikli araçlar, bir de VIP Mobilite sözleşmesi) şirketlerini ve kurumsal kullanıcılarını (`filo@ornek-lojistik.example` ve `filo@yesil-enerji.example`, parola yukarıda girdiğin) açar. Gerçek bir e-postaya ihtiyaç duyan akışlar (7: davet, 9: talep e-postası) için e-posta göndericisi şimdilik deneme göndericisidir: e-postalar yalnız Resend hesabının adresine gider (DEPLOY.md §3), bu yüzden o iki akışta davet edilen kullanıcı **o adresle** açılır.

### Kabul turu kontrol listesi (SPEC §6)
Her akış üç geçişte yapılır: **375 px mobil**, sonra **1280 px**, sonra **yalnızca klavyeyle** (Tab, Enter, Esc; fare yok). Sonuç sütunu turda doldurulur (Geçti / Sorun + #issue).

| # | Akış | Nasıl denenir | Veri | Sonuç |
|---|---|---|---|---|
| 1 | v1 akışları | Bireysel kiralama uçtan uca (arama → tutma → özet → ödeme → onay), Rezervasyonlarım, kurumsal teklif, ana sayfada filo bölümü penceresi, Bayilerimiz filtresi, iletişim formu, çerez reddi | Kendi bireysel hesabın | |
| 2 | Geçmiş tarih ve kampanya kodu | Geçmiş tarihli rezervasyon reddedilir (`IN_PAST`); aynı kampanya kodu ikinci kez kullanılamaz | Akış 5'in kodu | |
| 3 | Bayi yönetimi | Yönetici girer → yeni bayi ekler → Bayilerimiz'de ve aramada görünür → bayiyi kapatır → ikisinden de kalkar | Yönetici hesabı (G) | |
| 4 | Araç modeli | Yönetici fotoğraflı yeni bir model ve ona bir araç ekler → ana sayfa filo bölümünde ve aramada görünür → aracı kaldırır | Yönetici; bir fotoğraf (Blob) | |
| 5 | Kampanya kodu | Yönetici kod açar → kullanıcı özet sayfasında kullanır → tavan dolunca kod reddedilir | Yönetici, bir bireysel hesap | |
| 6 | Rezervasyon iptali | Yönetici bir rezervasyonu iptal eder → kullanıcının Rezervasyonlarım ve puanları doğru güncellenir → işlem kaydında görünür | Akış 1'in rezervasyonu | |
| 7 | Şirket ve davet | Yönetici şirket açar ve kullanıcı davet eder → davetli e-postadaki bağlantıyla şifre belirler → kurumsal sekmeden girer → Filom'u açar | Davetli, Resend hesabının e-postasıyla (deneme göndericisi) | |
| 8 | Zimmet, masraf, rapor | Filom'da araç bir personele zimmetlenir → yöneticinin girdiği HGS masrafı o personele eşlenir → müşteri masrafı yansıtır → fatura detayında "örnek fatura" notu → rapor toplamı fatura ve masraflarla tutar | Örnek Lojistik A.Ş. | |
| 9 | Yol yardım talebi | Filom'dan yol yardım talebi → yönetici durumu "Yolda" yapar → müşteri zaman çizelgesinde görür ve e-posta alır; VIP sözleşmesi olmayan şirkette transfer seçeneği yok | Örnek Lojistik A.Ş.; e-posta için akış 7'deki adres | |
| 10 | Canlı takip ve Yeşil Filo | `/filom/canli-takip`: araçlar ve "Simülasyon" rozeti; harita kapalıyken liste aynı bilgiyi verir; Yeşil Filo'da elektrikli araç için yakın istasyonlar | Yeşil Enerji Ltd. (elektrikli); rota ve istasyon seed'i | |
| 11 | Yetki sınırları | Bireysel hesap `/filom` ve `/yonetim`'e giremez (giriş ya da 404); A şirketinin kullanıcısı B şirketinin aracını adresle açamaz (404) | İki şirketin kullanıcısı, B'nin bir plakası | |

Turdan önce `pnpm check:live` (V2-45) temiz çıkmalı. Bir akış geçmezse sorun açılır, akış sonucuna issue numarası yazılır; kritik sorun varsa `v2.0.0` atılmaz.

## Etiketler
`faz-12` `P0` `belge`
