# Novera Mobility: Ürün Tanımı (SPEC)

> Durum: **Taslak v0.2** · 4 Ekim 2026
> Sahipler: G (frontend), arkadaş (backend)
> İçerik kaynağı: G'nin proje sohbetindeki ilk mesajı (misyon, vizyon, ürünler, hizmetler, hakkımızda)
> Açık karar yok. Değişiklikler PR ile yapılır.

---

## 1. Amaç, kitle, başarı

- **Amaç:** Kurgusal kurumsal araç kiralama şirketi Novera Mobility için, bireysel kullanıcının çevrimiçi araç rezervasyonu yapabildiği ve kurumsal firmanın filo teklifi isteyebildiği modern bir web sitesi.
- **Hedef kitle:** (1) Kısa dönem araç arayan bireysel kullanıcı ve KOBİ, (2) uzun dönem filo arayan kurumsal satın alma / filo yöneticisi.
- **Başarı ölçütü:** Bir bireysel kullanıcı mobilde ana sayfadan başlayıp sahte ödeme ekranına kadar rezervasyonu takılmadan tamamlayabiliyor; bir kurumsal kullanıcı teklif formunu gönderebiliyor.
- **Öğrenme hedefi (ekip için):** İki kişilik ekip, asenkron çalışarak (issue, PR, review) projeyi baştan sona şirket düzeninde yürütür.

---

## 2. Kapsam (v1)

### 2.1 Sayfalar

| Sayfa | Yol (TR) | Yol (EN) | Not |
|---|---|---|---|
| Ana sayfa (Araç Kirala) | `/` | `/en` | Bireysel / Kurumsal sekmeli arama alanı |
| Araç listesi | `/araclar` | `/en/cars` | Arama sonuçları + filtre |
| Araç detay | `/araclar/:slug` | `/en/cars/:slug` | Özellikler, fiyat, ek hizmet seçimi |
| Rezervasyon özeti | `/rezervasyon` | `/en/booking` | Tarih, lokasyon, ek hizmetler, toplam |
| Ödeme (sahte) | `/odeme` | `/en/payment` | Gerçek ödeme alınmaz |
| Rezervasyon onay | `/rezervasyon/onay` | `/en/booking/confirmation` | Rezervasyon numarası |
| Ürünler | `/urunler` | `/en/products` | 4 ürün; "En çok tercih edilen" öne çıkar |
| Ürün detay | `/urunler/:slug` | `/en/products/:slug` | Ürün içeriği + "Teklif Al" |
| Hizmetler | `/hizmetler` | `/en/services` | 5 hizmet, açılır-kapanır yapı |
| Hakkımızda | `/hakkimizda` | `/en/about` | Metin + zaman çizelgesi + sürdürülebilirlik + sayaçlar |
| İletişim | `/iletisim` | `/en/contact` | Harita + bayi arama + liste görünümü |
| Kurumsal teklif | `/kurumsal-teklif` | `/en/corporate-quote` | Ana sayfadaki Kurumsal sekmesi ve ürün detay sayfaları buraya bağlanır; navbar'da link yok |
| Giriş / Kayıt / Şifremi unuttum | `/giris`, `/kayit`, `/sifre-sifirla` | `/en/login`, `/en/register`, `/en/reset-password` |  |
| Profil | `/profil` | `/en/profile` | Alt sekmeler: Hesabım, Rezervasyonlarım, Ayarlar |
| Yasal | `/kvkk`, `/cerez-politikasi`, `/kiralama-kosullari` | `/en/privacy-notice`, `/en/cookie-policy`, `/en/rental-terms` | Kurgusal metin |
| 404 | — | — |  |

İngilizce yolları ADR-04 gereği `/en` altında çevrilmiştir (ör. `/araclar` ↔ `/en/cars`); eşleme `apps/web/i18n/routing.ts` içindedir.

### 2.2 Ana sayfadaki Bireysel / Kurumsal anahtarı

G'nin kararı: arama alanının üstünde iki seçenekli bir anahtar (segmented control). Seçim sadece arama alanını değil, **ana sayfanın kitleye özel bölümlerini** de değiştirir:

| Bölüm | Bireysel | Kurumsal |
|---|---|---|
| Arama alanı | Lokasyon + tarih → Araç Ara | Teklif ön formu → Teklif İste |
| Öne çıkan içerik | Araç sınıfları | 4 ürün (filo çözümleri) |
| Sık sorulan sorular | Bireysel SSS seti | Kurumsal SSS seti |
| Yol Boyu Güvence | Ortak | Ortak |
| İş ortakları, footer | Ortak | Ortak |

- **Bireysel (varsayılan):** alış lokasyonu, iade lokasyonu ("farklı yere iade" seçeneği), alış tarih-saat, iade tarih-saat → **Araç Ara** → `/araclar`.
- **Kurumsal:** kısa bir teklif ön formu (firma adı, ihtiyaç duyulan araç sayısı, kiralama süresi, araç tipi, iletişim e-postası) → **Teklif İste** → `/kurumsal-teklif` sayfasına bu bilgiler dolu olarak gider. Gerekçe: kurumsal kiralama tarih seçip ödemeyle değil, teklif ve sözleşmeyle ilerler.
- Seçim URL'de tutulur (`/?tip=kurumsal`) ki link paylaşılınca aynı sekme açılsın.

### 2.3 Akışlar

**Bireysel rezervasyon:**
Ana sayfa (Bireysel) → Araç listesi → Araç detay → ek hizmet seçimi → Rezervasyon özeti → giriş/kayıt → Sahte ödeme → Onay

- Tek rezervasyon akışı; sepet yok.
- Listeleme ve detay herkese açık; giriş **ödeme adımından hemen önce** istenir (G onayladı). Gerekçe: erken giriş zorunluluğu kullanıcıyı kaybettirir.

**Kurumsal teklif:**
Ana sayfa (Kurumsal) veya Ürün detay → Teklif formu → "Talebiniz alındı" ekranı

**Bayi bulma:**
İletişim → harita tüm bayileri gösterir → şehir veya bayi adıyla arama → bayi kartı (adres, çalışma saatleri, `tel:` telefon, e-posta, yol tarifi linki). Mobilde harita ↔ liste geçişi.

### 2.4 Navigasyon

```
Masaüstü: [Logo] Araç Kirala · Ürünler · Hizmetler · Hakkımızda · İletişim               [Profil]
Mobil:    [Logo]                                                   [Profil] [☰]
```

- Navbar'da ayrı "Kurumsal Teklif" linki yok (G'nin kararı); kurumsal giriş noktası ana sayfadaki anahtar ve ürün sayfaları.
- Hamburger = site gezintisi (sadece mobil). Profil menüsü = hesap (her ekranda).
- Giriş yapılmamışsa Profil yerine "Giriş Yap".
- Dil (TR/EN), tema (açık/koyu) ve para birimi (TRY/EUR/USD) seçimi footer'da da bulunur; giriş yapan kullanıcıda tercih hesaba kaydedilir. Tutarlar günlük kurla çevrilir (ARCHITECTURE ADR-15); ödeme sahte olduğu için hangi para birimi seçilirse seçilsin para alınmaz.

---

## 3. Kapsam dışı (v1)

Bunlar sitede **sadece tanıtım içeriği** olarak yer alır, işlevsel olarak geliştirilmez (G'nin kararı):

- Novera Admin Paneli
- Novera Driver App, dijital hasar tutanağı
- Canlı GPS / telematik takip
- SOS butonu ve canlı çekici yönlendirme
- Gerçek ödeme entegrasyonu (ödeme ekranı sahte, para alınmaz)
- Çoklu araç sepeti
- Kariyer, basın/medya sayfaları
- Kurumsal hesap türü ("Filom" paneli)

---

## 4. İçerik

- **Dil:** Türkçe ana dil; İngilizce v1'de seçenek olarak var (G'nin kararı). Tüm arayüz metinleri baştan çeviri dosyalarından okunur, sayfaya gömülü metin yazılmaz. URL yapısı: `/` Türkçe, `/en/...` İngilizce.
- **Ton:** Kurumsal ama mesafeli değil. Güven veren, net, abartısız. "Sarsılmaz", "öncü" gibi büyük kelimeler hakkımızda metninde kalabilir; arayüz metinlerinde (buton, hata, form) sade ve kısa dil.
- **Yazım kuralları:** Buton metinleri fiille başlar ("Araç Ara", "Teklif İste"). Fiyatlar `₺1.250` biçiminde. Tarihler `12 Eki 2026`.
- **Metin bütçesi:** Kart açıklaması en fazla 2 satır (~120 karakter). Ürün/hizmet özeti en fazla 40 kelime; uzunu detay sayfasına.
- **Sürdürülebilirlik:** Hakkımızda'da ayrı bölüm. Her iddia ölçülebilir olmalı (filodaki elektrikli/hibrit oranı, yıllık CO₂ tasarrufu, geri dönüştürülen lastik sayısı, kağıtsız tutanak). Rakamlar kurgusal ama tutarlı tutulur.

---

## 5. Tasarım yönü

> G'nin yönlendirmesi: marka rengi doğa yeşili; tipografi modern ve kurumsal; sade ve net ama düz değil; orantılı boşluklar; akılda kalacak öğe güven odaklı.

### 5.1 Renk

**Ana renk: orman yeşili `#1D5A40`.** Parlak, açık yeşil (yaprak yeşili) "çevreci girişim" gibi okunur; koyu, doygunluğu düşük orman yeşili ise bankalarda ve sigortacılarda görülen ağırlığı taşır. Doğa vurgusu ve güven aynı renkte buluşuyor. Beyaz üzerinde kontrastı 8.1:1, yani hem metin hem buton zemini olarak kullanılabilir.

**Nötrler: yeşile çekik taş grisi.** Saf gri yeşilin yanında soğuk ve "hazır şablon" gibi durur. Grilere çok az yeşil karıştırmak tüm sayfayı tek bir aile gibi gösterir. Sayfa zemini saf beyaz değil, kâğıt tonu `#F8F9F6`: göz yormaz, kartlar (beyaz) zeminden hafifçe ayrılır.

**Vurgu: kil / toprak `#C0703A`.** Renk çemberinde yeşilin karşısında kırmızı-turuncu bölge var. Saf kırmızı hata rengiyle karışacağı için toprağa çekilmiş, doğayla uyumlu bir kil tonu seçildi. **Çok az kullanılır:** "En çok tercih edilen" rozeti, öne çıkan küçük işaretler. Butonlar yeşil kalır.

| Token | Hex | Kullanım |
|---|---|---|
| `green-900` | `#0F2E21` | Koyu bant bölümler, footer zemini |
| `green-800` | `#164331` | Hover (buton), açık zeminde başlık alternatifi |
| `green-700` | `#1D5A40` | **Ana marka rengi**, birincil buton, linkler |
| `green-600` | `#25704F` | Koyu temada birincil buton |
| `green-300` | `#8FC2A5` | Koyu zeminde vurgu metni, ikon |
| `green-100` | `#E3F0E8` | Seçili durum zemini, rozet zemini |
| `green-50` | `#F1F7F3` | Hafif bölüm zemini |
| `stone-950` | `#141A17` | Ana metin |
| `stone-700` | `#3E4742` | İkincil metin |
| `stone-500` | `#67706B` | Yardımcı metin, placeholder (en küçük metin boyutunda kullanılmaz) |
| `stone-400` | `#858D88` | Form kenarlığı (beyaz üzerinde 3.41:1, WCAG 1.4.11 için en az 3:1) |
| `stone-300` | `#C9CEC9` | Dekoratif kenarlık |
| `stone-200` | `#E2E5E1` | Ayırıcı çizgi |
| `stone-100` | `#EFF1EE` | Pasif zemin |
| `paper` | `#F8F9F6` | Sayfa zemini |
| `white` | `#FFFFFF` | Kart ve form zemini |
| `clay-500` | `#C0703A` | Vurgu (ikon, nokta, çizgi) |
| `clay-700` | `#8A4A22` | Vurgu zemininde metin |
| `clay-100` | `#F6E6D9` | Vurgu rozet zemini |
| `error` | `#B42318` | Hata |
| `warning` | `#9A6700` | Uyarı |
| `success` | `green-700` | Başarı (marka rengiyle aynı, ayrı yeşil eklenmez) |

**Ölçülen kontrastlar (WCAG):** `green-700`/beyaz 8.11 · `stone-950`/paper 16.70 · `stone-700`/paper 9.10 · `stone-500`/paper 4.84 · `stone-500`/`green-50` 4.71 · beyaz/`green-600` 5.98 · `clay-700`/`clay-100` 5.59 · `error`/beyaz 6.57 · `warning`/beyaz 4.87. Hepsi AA (4.5:1) üstünde.

**Koyu tema:** zemin `#101814`, kart `#18231D`, metin `stone-100`, birincil buton `green-600`, link ve vurgu `green-300`. Ölçülen: metin/zemin 15.90 · ikincil metin `#B4BDB7` 9.38 · yardımcı metin `#8E9892` 6.07 · link 8.97 · beyaz/`green-600` 5.98 · form kenarlığı `#68756D` kart üzerinde 3.36. Değerlerin tamamı `apps/web/app/globals.css` içinde.

### 5.2 Tipografi

**Manrope**, tek aile, değişken font (ağırlık 400–800).

- Neden: Geometrik ama soğuk değil; harf aralıkları açık, küçük boyutta okunaklı. Teknoloji ağırlıklı bir mobilite markasına modern, kurumsal sitede ciddi duruyor. Rakamları net; fiyat ve sayaçlarda tablo rakamı (`font-variant-numeric: tabular-nums`) kullanılır, fiyatlar kaymadan hizalanır.
- Neden tek aile: tek değişken font dosyası, iki ayrı aileden daha az indirme demek. Hafif site, sürdürülebilirlik anlatısıyla da tutarlı.
- Türkçe: ç, ğ, ı, İ, ö, ş, ü ve ₺ glifleri font dosyasında doğrulandı.
- Lisans: SIL Open Font License, ücretsiz.

| Rol | Boyut (mobil → masaüstü) | Ağırlık | Satır yüksekliği |
|---|---|---|---|
| Display (hero başlığı) | 36 → 56px | 700 | 1.1 |
| H1 | 30 → 44px | 700 | 1.15 |
| H2 | 24 → 32px | 700 | 1.2 |
| H3 | 20 → 24px | 600 | 1.3 |
| Gövde | 16 → 17px | 400 | 1.6 |
| Küçük | 14px | 500 | 1.5 |
| Etiket / buton | 15px | 600 | 1 |

Gövde metni en fazla ~68 karakter genişliğinde tutulur.

### 5.3 Boşluk ve şekil

- **Boşluk ölçeği:** 4px tabanlı: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Orantı kuralı: bir öğenin içindeki boşluk, öğeler arasındaki boşluktan her zaman küçük (kart içi 24 → kartlar arası 32 → bölümler arası 96).
- **Bölümler arası:** mobil 64px, masaüstü 96–128px.
- **Izgara:** 4 sütun (mobil, 16px kenar boşluğu) · 8 sütun (tablet) · 12 sütun (masaüstü, en fazla 1200px içerik genişliği).
- **Köşe yarıçapı:** form ve buton 10px, kart 16px, büyük görsel 24px, anahtar (toggle) tam yuvarlak.
- **Gölge:** neredeyse yok. Derinlik gölgeyle değil zemin tonu farkıyla (paper → beyaz kart) verilir; sadece açılan menülerde ve arama alanında hafif gölge.
- **Kırılma noktaları:** 375 (tasarım buradan başlar) · 768 · 1280.

### 5.4 Yerleşim konsepti: "sade, ama düz değil"

- Sadelik az öğeden gelir: her bölümün tek bir görevi ve tek bir birincil butonu var.
- "Düz değil" hissi ritimden gelir, süsten değil:
  - Bölümler her zaman ortalanmış değil; metin solda / görsel sağda, sonraki bölümde tam genişlik, sonra koyu bant. Göz her bölümde aynı kalıba alışmaz.
  - Sayfa akışında bir kez **koyu orman yeşili bant** (`green-900`) kullanılır: Yol Boyu Güvence bölümü. Açık sayfada tek koyu bölüm, dikkati oraya toplar.
  - Büyük, kenarları yuvarlatılmış fotoğraflar; araç fotoğraflarında doğal ışık ve açık hava.
- Hareket: sadece durum değişikliğini anlatan geçişler (anahtar değişince alanın yumuşak geçişi, açılır-kapanır SSS). Kaydırınca beliren dekoratif animasyon yok. `prefers-reduced-motion` desteklenir.

### 5.5 Akılda kalacak tek öğe: Yol Boyu Güvence

Hakkımızda metnindeki "Sadece Araç Kiralamıyoruz, Yol Boyu Güvence Sunuyoruz" cümlesi markanın güven vaadi. Bu vaat sitede **somut bir bileşene** dönüşür:

- **Ana sayfada:** koyu yeşil bantta, bir aksilik anının senaryosu olarak anlatılır: *Yolda kaldın → tek dokunuşla SOS → GPS ile en yakın çekici yönlendirilir → 7/24 operasyon masası seni arar → arıza 24 saati aşarsa yedek araç kapında.* İkon kartları değil, soldan sağa (mobilde yukarıdan aşağı) ilerleyen tek bir zaman çizgisi.
- **Karar anlarında tekrar:** araç detayında, rezervasyon özetinde ve ödeme ekranında aynı güvencenin kısa bir şerit hâli ("Bu kiralama Yol Boyu Güvence kapsamında: 7/24 destek, çekici, yedek araç"). Kullanıcı tam para öderken güven mesajını görür.
- **Şeffaf fiyat:** rezervasyon özetinde tüm kalemler açık yazılır, "gizli ücret yok" ibaresi. Güven sadece söylenmez, fiyat ekranında gösterilir.

### 5.6 Kaçınılacaklar

Eşit üç sütunlu ikon+başlık+gri metin kartları, gerekçesiz gradient, sırası olmayan içeriğe 01/02/03, her bölümde aynı ortalanmış yerleşim, amaçsız animasyon, saf siyah metin, saf gri nötrler.

### 5.7 Erişilebilirlik

WCAG 2.2 AA. Metin kontrastı en az 4.5:1, dokunma hedefi en az 44×44px, görünür odak halkası (`green-700`, 2px, 2px boşluk), tüm akışlar klavyeyle tamamlanabilir, anahtar (Bireysel/Kurumsal) ekran okuyucuda seçili durumu bildirir.

---

## 6. Medya envanteri

| Tür | Kullanım yeri | Kaynak | Lisans | Adet | En-boy | Bütçe |
|---|---|---|---|---|---|---|
| Araç fotoğrafı | Liste, detay | Telifsiz stok veya üretici basın fotoğrafı | Kontrol edilecek | ~12 | 16:10 | ≤120 KB/adet (WebP/AVIF) |
| Ana sayfa görseli | Hero | Stok | Kontrol edilecek | 1 | 16:9 masaüstü, 4:5 mobil | ≤200 KB |
| Ürün görselleri | Ürün kartları ve detay | Stok | Kontrol edilecek | 4 | 3:2 | ≤150 KB |
| İkonlar | Hizmetler, özellikler | Açık kaynak ikon seti | MIT/ISC | ~30 | 1:1 SVG | Satır içi SVG |
| İş ortağı logoları | Ana sayfa | Kurgusal üretilecek | — | 6–8 | Serbest, SVG | ≤10 KB/adet |
| Logo | Header, footer, favicon | Ekip üretecek | — | 1 set | SVG | — |
| Harita | İletişim | Google Maps JavaScript API (backend tarafı kuracak) | Google Maps Platform şartları | — | — | Harita kütüphanesi sadece İletişim sayfasında yüklenir |

---

## 7. Veri (backend ile ortak sözleşmenin girdisi)

Ayrıntılı API kontratı ayrı belgede yazılacak. Temel varlıklar:

`User`, `Branch` (bayi: ad, şehir, adres, koordinat, telefon, e-posta, çalışma saatleri), `VehicleClass`, `Vehicle`, `Extra` (ek hizmet: çocuk koltuğu, ek sürücü vb.), `Reservation`, `QuoteRequest`, `FaqItem`, `Product`, `Service`, `ExchangeRate` (kur: para birimi, TRY'ye oran, güncellenme zamanı).

Ürün ve hizmet içeriği API'den gelir, iki dilli alanlarla (ADR-17). Tutarlar `{ amount, currency }` olarak, para biriminin alt birimi cinsinden tam sayıyla taşınır (ADR-15). Zamanlar ISO 8601 UTC'dir, ekranda `Europe/Istanbul` ile gösterilir (ADR-16).

---

## 8. Uçtan uca doğrulama

v1 "bitti" sayılmadan önce, 375px genişlikte mobil tarayıcıda:

1. Ana sayfada Bireysel seçili; lokasyon ve tarih seçilip araç aranır.
2. Listede filtre uygulanır, bir araç açılır, bir ek hizmet seçilir.
3. Özet ekranında toplam doğru hesaplanır; giriş yapılır; sahte ödeme ekranı geçilir; onay sayfasında rezervasyon numarası görünür.
4. Profil > Rezervasyonlarım'da bu rezervasyon listelenir.
5. Ana sayfada Kurumsal'a geçilir; ön form doldurulur; teklif sayfası dolu açılır ve gönderilir.
6. İletişim'de "İzmir" aranır; harita ve liste ilgili bayiye daralır.
7. Aynı akışlar 1280px masaüstünde ve yalnızca klavyeyle tekrarlanır.
