# Novera Mobility: Ürün Tanımı (SPEC)

> Durum: **Taslak v0.4** · 10 Ekim 2026 (v0.3: 9 Ekim, v0.2: 4 Ekim 2026)
> Sahipler: G (frontend), arkadaş (backend)
> İçerik kaynağı: G'nin proje sohbetindeki ilk mesajı (misyon, vizyon, hakkımızda). v0.3: G'nin 9 Ekim site güncellemesi mesajı ve aynı gün verdiği cevaplar (sayfa yapısı, ürün ve hizmet içeriği, kalite gereksinimleri). v0.4: G'nin 10 Ekim tasarım geri bildirimi (yeni renk paleti, beyaz zemin, tercihlerin navbara taşınması, ana sayfa ve Araçlarımız düzeni).
> Açık kararlar §10'da. Değişiklikler PR ile yapılır.

---

## 1. Amaç, kitle, başarı

- **Amaç:** Kurgusal kurumsal araç kiralama şirketi Novera Mobility için, bireysel kullanıcının çevrimiçi araç rezervasyonu yapabildiği ve kurumsal firmanın görüşme talebi bırakabildiği modern bir web sitesi.
- **Hedef kitle:** (1) Kısa dönem araç arayan bireysel kullanıcı ve KOBİ, (2) uzun dönem filo arayan kurumsal satın alma / filo yöneticisi.
- **Başarı ölçütü:** Bir bireysel kullanıcı mobilde ana sayfadan başlayıp sahte ödeme ekranına kadar rezervasyonu takılmadan tamamlayabiliyor; bir kurumsal kullanıcı talep formunu gönderebiliyor.
- **Öğrenme hedefi (ekip için):** İki kişilik ekip, asenkron çalışarak (issue, PR, review) projeyi baştan sona şirket düzeninde yürütür.

---

## 2. Kapsam (v1)

### 2.1 Sayfalar

| Sayfa | Yol (TR) | Yol (EN) | Not |
|---|---|---|---|
| Ana sayfa (Araç Kirala) | `/` | `/en` | Kampanya galerisi, Bireysel / Kurumsal kiralama kutusu, iş birlikleri, Yol Boyu Güvence, SSS (§2.2) |
| Arama sonuçları | `/araclar` | `/en/cars` | Seçilen bayide ve tarihlerde uygun araçlar; fotoğraf, bilgi, fiyat ve **Kirala** butonu. Üstte düzenlenebilir arama (§2.3) |
| Araçlarımız | `/araclarimiz` | `/en/our-cars` | Filodaki tüm modeller; karta tıklanınca pencere açılır, yeni sayfa açılmaz (§2.4) |
| ~~Araç detay~~ | ~~`/araclar/:slug`~~ | ~~`/en/cars/:slug`~~ | **Kaldırıldı (v0.3):** araç bilgisi kartta ve Araçlarımız penceresinde; Kirala doğrudan rezervasyon özetine gider, ek hizmet seçimi özete taşındı |
| Rezervasyon özeti | `/rezervasyon` | `/en/booking` | Tarih, lokasyon, **ek hizmet seçimi**, kalem kalem fiyat, toplam |
| Ödeme (sahte) | `/odeme` | `/en/payment` | Gerçek ödeme alınmaz |
| Rezervasyon onay | `/rezervasyon/onay` | `/en/booking/confirmation` | Rezervasyon numarası |
| Ürünler | `/urunler` | `/en/products` | 4 ürün; "En çok tercih edilen" öne çıkar (içerik Ek A) |
| Ürün detay | `/urunler/:slug` | `/en/products/:slug` | Konsept, Ne Alıyorsunuz, Teknolojik Artısı + "Teklif Al" |
| Hizmetler | `/hizmetler` | `/en/services` | 5 hizmet, açılır-kapanır yapı (içerik Ek A) |
| Hakkımızda | `/hakkimizda` | `/en/about` | Hikayemiz (eğri zaman çizelgesi), rakamlar (sayaç), misyon/vizyon, sürdürülebilirlik (§2.7) |
| İletişim | `/iletisim` | `/en/contact` | Genel merkez, departman e-postaları, iletişim formu, bayi listesi + harita (§2.6) |
| Kurumsal teklif | `/kurumsal-teklif` | `/en/corporate-quote` | Ürün sayfalarındaki "Teklif Al" buraya gelir; navbar'da link yok. Ana sayfadaki kurumsal kutuyla ilişkisi açık karar (§10) |
| Giriş / Kayıt / Şifremi unuttum | `/giris`, `/kayit`, `/sifre-sifirla` | `/en/login`, `/en/register`, `/en/reset-password` |  |
| Profil | `/profil` | `/en/profile` | Alt sekmeler, her biri kendi sayfası: Hesabım (`/profil`), Rezervasyonlarım (`/profil/rezervasyonlar`, `/en/profile/bookings`), Ayarlar (`/profil/ayarlar`, `/en/profile/settings`). Giriş yapılmamışsa "giriş yapın" bildirimi gösterilir |
| Yasal | `/kvkk`, `/cerez-politikasi`, `/kiralama-kosullari`, `/gizlilik-politikasi`, `/kullanim-sartlari` | `/en/privacy-notice`, `/en/cookie-policy`, `/en/rental-terms`, `/en/privacy-policy`, `/en/terms-of-use` | Kurgusal metin. KVKK aydınlatma metni ile gizlilik politikası ayrı belgelerdir (v0.3) |
| 404 | — | — | Markalı, ana sayfaya dönüş |
| 500 | — | — | Markalı hata sayfası: tekrar dene + ana sayfa (v0.3) |

İngilizce yolları ADR-04 gereği `/en` altında çevrilmiştir (ör. `/araclar` ↔ `/en/cars`); eşleme `apps/web/i18n/routing.ts` içindedir.

### 2.2 Ana sayfa

Yukarıdan aşağıya bölüm sırası:

| # | Bölüm | Not |
|---|---|---|
| 1 | Kampanya galerisi | §2.2.1 |
| 2 | Kiralama kutusu | Sayfanın `h1`'i ("Araç Kirala") bu bölümün başlığıdır ve **ortalanır**. Altında, yine ortalı, yalnızca iki buton: **Bireysel** / **Kurumsal**; butonların çevresinde kutu ya da çerçeve yok (v0.4, G). Altında form (§2.2.2, §2.2.3) |
| 3 | İş birlikleri | Kayan logo şeridi (§2.2.4) |
| 4 | Yol Boyu Güvence | Koyu zeytin bant, modernleştirilmiş (§5.5) |
| 5 | Sık sorulan sorular | §2.2.5 |
| 6 | Footer | §2.8 |

v0.2'deki kitleye göre değişen "araç sınıfları" ("Size uygun sınıfı seçin") ve "4 ürün" bölümleri kaldırıldı (G'nin kararı, 10 Ekim'de yinelendi). `h1` galeride değil kutuda durur, çünkü galeri kampanya içeriğidir, sayfanın konusu araç kiralamaktır.

#### 2.2.1 Kampanya galerisi

- 3–4 slayt. Her slaytta görsel, başlık, kısa metin ve tek bir CTA. Metinler çeviri dosyasında.
- **Otomatik geçiş yok.** Geçiş oklar, noktalar ve kaydırmayla (dokunmatikte sürükleme) yapılır; klavyeyle kullanılabilir.
- İlk slaytın görseli sayfanın en büyük görselidir (LCP); öncelikli yüklenir, diğerleri tembel yüklenir.
- Görseller fotoğraf kararına kadar yer tutucu (§10). İçeriğin sabit mi API'den mi geleceği açık karar; şimdilik sabit.

#### 2.2.2 Bireysel (varsayılan)

- Alış bayisi, bırakılacak bayi, tarih aralığı (tek takvim) ve alış/iade saati (30 dakikalık dilimler, ADR-16) → **Ara** → `/araclar`.
- Bayi listesinde her bayinin altında o bayideki birkaç aracın adı kısaca görünür ("Toyota Corolla Hybrid, Nissan Qashqai +2"), böylece bayi seçmek aynı zamanda ilk bakış olur.
- Bırakılacak bayi her zaman seçilir; kullanıcı dokunmadıkça alış bayisini izler (çoğu kiralama başladığı yerde biter).
- Arama formunda **araç seçilmez**; araç, sonuç sayfasında seçilir.

#### 2.2.3 Kurumsal

- Gerekçe (G): kurumsal müşteri bireysel gibi kendi başına rezervasyon yapmaz. Araçlar istenen yere götürülür ve istenen yerden geri alınır, fiyat buna göre değişir; ayrıca birden fazla araç seçilebilir. Bu yüzden akış **form + görüşme**: müşteri bilgilerini bırakır, satış ekibi arar.
- Bu kısım profesyonel görünmelidir. **Tasarım önerisi uygulanmadan önce G'ye gösterilir ve onaylanır** (§10).
- Form KVKK onay kutusu ve spam koruması taşır (§9); gönderince "Talebiniz alındı" durumu gösterilir.
- Seçim URL'de tutulur (`/?tip=kurumsal`), link paylaşılınca aynı seçim açılır. Seçim yalnızca kutuyu ve SSS'nin açık sekmesini değiştirir; sayfanın geri kalanı iki kitle için aynıdır.

#### 2.2.4 İş birlikleri

- 8 kurgusal şirket logosu (SVG). Gerçek marka logosu kullanılmaz.
- Görsel ve davranış referansı: Framer "InfiniteLogoMarquee". Şerit sola doğru sürekli akar; logolar gri ve soluktur, üzerine gelince renklenir ve hafifçe büyür; üzerine gelince şerit durur.
- Görünür bir **Durdur / Oynat** düğmesi vardır: WCAG 2.2.2 beş saniyeden uzun süren otomatik hareketin durdurulabilmesini ister, hover ise dokunmatikte ve klavyede yoktur. `prefers-reduced-motion` açıksa şerit hiç hareket etmez.
- Ekran okuyucu logoları bir kez okur; döngü için tekrarlanan kopyalar gizlidir.

#### 2.2.5 Sık sorulan sorular

- Referans: Framer "Spring FAQ Accordion" satır düzeni ve yaylı açılma; "AK FAQ"'tan kategori sekmeleri ve altta iletişim çağrısı.
- Sekmeler: **Bireysel** / **Kurumsal**. Başlangıçta kiralama kutusunda seçili olan sekme açıktır.
- Aynı anda bir soru açık. Arama kutusu ve soru numarası yok (§5.6: sırası olmayan içeriğe numara verilmez).
- Altta "Sorunuz mu kaldı?" ve İletişim sayfasına bağlantı.
- Açılma animasyonu `prefers-reduced-motion`'da kapalıdır.
- İçerik API'den gelir (`GET /faq?audience=`); yükleniyor, boş ve hata durumları vardır.

### 2.3 Akışlar

**Bireysel rezervasyon:**
Ana sayfa (Bireysel) → Arama sonuçları → **Kirala** → Rezervasyon özeti (ek hizmet seçimi + kalem kalem fiyat) → giriş/kayıt → Sahte ödeme → Onay

- Tek rezervasyon akışı; sepet yok.
- Arama ve sonuçlar herkese açık; giriş **ödeme adımından hemen önce** istenir (G onayladı). Gerekçe: erken giriş zorunluluğu kullanıcıyı kaybettirir.
- Sonuç sayfası arama bilgilerini adreste taşır (`?alis=&iade=&baslangic=&bitis=`), böylece paylaşılabilir ve yenilenebilir. Üstte bir arama özeti kalır (bayiler, tarihler); "Aramayı değiştir" ile açılıp düzenlenebilir ve yeniden aranabilir.
- Her araç kartında fotoğraf, bilgi (koltuk, bavul, vites, yakıt), fiyat (günlük ve toplam) ve **Kirala** butonu. Kirala, seçilen araç ve arama bilgileriyle `/rezervasyon`'a gider.
- Uygun araç yoksa, arama yapılmamışsa ve veri alınamıyorsa her biri için ayrı bir durum gösterilir.
- Ekrandaki toplam gösterim içindir; tahsil edilen tutarı backend hesaplar (ADR-15).

**Kurumsal talep:**
Ana sayfa (Kurumsal) → form → "Talebiniz alındı" → satış ekibi arar. Ürün detayındaki "Teklif Al" → `/kurumsal-teklif`.

**Bayi bulma:**
İletişim → şehir filtresi ve/veya arama → liste ve haritadaki pinler daralır → bayi kartı (adres, çalışma saatleri, `tel:` telefon, e-posta, yol tarifi linki).

### 2.4 Araçlarımız

- Filodaki tüm modeller, sınıfa göre gruplu; sınıflar ve modeller ucuzdan pahalıya.
- **Kategoriler (v0.4):** sayfanın üstünde kategori çipleri ("Tümü", "Ekonomik", "Orta sınıf"…); biri seçilince liste o kategoriye süzülür. Kategori bölümleri belirgin başlık, model sayısı ve aralarında net boşlukla ayrılır.
- **Kart yatay (v0.4):** fotoğraf solda, bilgiler sağda; mobilde de yatay, sıkıştırılmış. Stok fotoğraf, marka-model, sınıf, hap bilgiler (yakıt tüketimi: L/100 km, elektrikli araçta kWh/100 km; yakıt tipi; vites; koltuk; bagaj) ve "…'den başlayan" günlük fiyat. Kartın içinde sağda bir ok işareti; hover'da kart ve ok tepki verir. Kartın tamamı tek bir tıklama hedefidir.
- **Pencere:** karta tıklanınca yeni sayfa açılmaz, pencere (modal) açılır. İçerik: daha detaylı bilgi (tüm özellikler, kısa açıklama) ve modelin bulunduğu bayiler (bayi adı, şehir; İletişim sayfasına bağlantı).
- Pencere adreste iz bırakır: `/araclarimiz?arac=<model>`. Link paylaşılınca aynı pencere açık gelir; geri tuşu ve Esc kapatır; kapanınca odak tıklanan karta döner. Arama motoru için kanonik adres `/araclarimiz`'dir (ARCHITECTURE ADR-22).

### 2.5 Ürünler ve hizmetler

- Arayüz şimdiki haliyle kalır; G ileride modernleştirecek. Bu sürümde yalnızca içerik değişir (Ek A).
- Ürün detayı üç bölümdür: **Konsept**, **Ne Alıyorsunuz?**, **Teknolojik Artısı** (v0.2'deki "Neler dahil" ve "Kimler için" yerine). Ürün kartında başlık, Konsept metni ve "En çok tercih edilen" rozeti (yalnızca Akıllı Kurumsal Filo Kiralama).
- Hizmetlerde her hizmetin başlığı, Ek A'daki tek cümlelik açıklaması ve 3 kısa maddesi bulunur. Maddeleri Claude yazar (G onayladı), Ek A'daki iddiaların dışına çıkmaz.
- Ürün adresleri yeni slug'larla değişir (Ek A). Site yayında olmadığı için eski adreslere yönlendirme gerekmez.

### 2.6 İletişim

Yukarıdan aşağıya:

1. Başlık ve kısa giriş.
2. **Genel merkez:** fotoğraf (yer tutucu), adres, `tel:` telefon, `mailto:` e-posta, yol tarifi linki.
3. **Departman e-postaları:** Pazarlama, Satış, İş Birlikleri; her biri ayrı `mailto:` bağlantısı.
4. **İletişim formu:** ad soyad, e-posta, telefon (isteğe bağlı), konu, mesaj, KVKK onay kutusu; gönderince "Mesajınız alındı" durumu (§9).
5. **Bayiler ve harita:** masaüstünde (1280 px ve üstü) bayiler haritanın solunda alt alta listelenir. Listenin üstünde şehir filtresi (açılır liste) ve metin arama (bayi adı, ilçe, adres). Filtre ve arama hem listeyi hem haritadaki pinleri daraltır. 1280 px altında Liste / Harita geçişi. Harita yüklenemezse liste görünür.

Genel merkez ve departman bilgileri kurgusaldır ve sabit içeriktir (çeviri dosyası); e-postalar gerçek bir kişiye gitmeyen ayrılmış bir alan adıyla yazılır (`.example`). Bayi verisi API'den gelir.

### 2.7 Hakkımızda

- **Hikayemiz:** referans Framer "Oxbow". Dalgalı bir çizgi üzerinde yıllar; seçilen kilometre taşının kartı (görsel, yıl, başlık, metin) açılır. Oklar, klavye (sol/sağ ok) ve dokunmatikte kaydırmayla gezilir; otomatik oynatma yok. 768 px altında dikey liste. Mevcut 6 kilometre taşı kullanılır, her biri bir görselle (yer tutucu).
- **Rakamlar:** referans Framer "StatsSection". Ortalanmış büyük sayılar ve etiketleri; bölüm görününce sayılar bir kez, yaklaşık 2 saniyede yavaşlayarak artar. `prefers-reduced-motion`'da doğrudan son değer görünür; ekran okuyucu yalnızca son değeri okur. Değerler §4.1'deki tablodan.
- Sayfanın geri kalanı (açılış, misyon/vizyon, sürdürülebilirlik, CTA) tasarım olarak değişmez; G sonra modernleştirecek. Yalnızca metinlerdeki rakamlar §4.1'e göre düzeltilir.

### 2.8 Navigasyon ve footer

```
Masaüstü: [Logo] Araç Kirala · Araçlarımız · Ürünler · Hizmetler · Hakkımızda · [İletişim]   [Profil]
Mobil:    [Logo]                                                     [Profil] [☰]
```

- Navbar'daki linkler v0.2'deki gibi kalır. **İletişim, diğer linklerden farklı görünür** (çerçeveli buton görünümü) ve **diğer linklerden belirgin bir boşlukla ayrı durur**; Giriş Yap / Profil butonundan da ayırt edilebilir. Mobil menüde de aynı vurgu.
- **Giriş Yap** butonu zeminden ayrışan bir dolguya sahiptir; zeminle aynı renkte kalmaz (v0.4, G).
- **Tercihler (v0.4, G):** dil, tema ve para birimi navbarda tek bir ikon düğmesiyle açılan küçük bir panelde; mobilde hamburger menünün içinde. Footer'da tercih yok.
- Navbar'da ayrı "Kurumsal Teklif" linki yok (G'nin kararı); kurumsal giriş noktası ana sayfadaki seçim ve ürün sayfaları.
- Hamburger = site gezintisi. Altı bağlantı 1280px altında yan yana sığmadığı için hamburger mobilde ve tablette görünür, satır içi menü 1280px ve üstünde. Profil menüsü = hesap (her ekranda).
- Giriş yapılmamışsa Profil yerine "Giriş Yap".
- **Footer:** referans Framer "Simple Footer": solda logo, kısa tanım ve altında telif + "kurgusal proje" notu; sağda sade sütunlar: Keşfet linkleri, Yasal linkler (5 sayfa ve "Çerez tercihleri"), iletişim. Sosyal medya sütunu yok (kurgusal şirketin hesabı yok; uydurulmaz).
- Dil (TR/EN), tema (açık/koyu/sistem; **varsayılan açık**) ve para birimi (TRY/EUR/USD) seçimi navbardaki tercih panelindedir; giriş yapan kullanıcıda tercih hesaba kaydedilir. Tutarlar günlük kurla çevrilir (ARCHITECTURE ADR-15); ödeme sahte olduğu için hangi para birimi seçilirse seçilsin para alınmaz.

---

## 3. Kapsam dışı (v1)

Bunlar sitede **sadece tanıtım içeriği** olarak yer alır, işlevsel olarak geliştirilmez (G'nin kararı):

- Novera Admin Paneli
- Novera Driver App, dijital hasar tutanağı
- Canlı GPS / telematik takip
- SOS butonu ve canlı çekici yönlendirme
- Gerçek ödeme entegrasyonu (ödeme ekranı sahte, para alınmaz)
- Çoklu araç sepeti
- Kurumsal müşterinin siteden kendi başına rezervasyon yapması (kurumsal akış form + görüşme, §2.2.3)
- Kariyer, basın/medya sayfaları
- Kurumsal hesap türü ("Filom" paneli)

---

## 4. İçerik

- **Dil:** Türkçe ana dil; İngilizce v1'de seçenek olarak var (G'nin kararı). Tüm arayüz metinleri baştan çeviri dosyalarından okunur, sayfaya gömülü metin yazılmaz. URL yapısı: `/` Türkçe, `/en/...` İngilizce.
- **Ton:** Kurumsal ama mesafeli değil. Güven veren, net, abartısız. "Sarsılmaz", "öncü" gibi büyük kelimeler hakkımızda metninde kalabilir; arayüz metinlerinde (buton, hata, form) sade ve kısa dil.
- **Yazım kuralları:** Buton metinleri fiille başlar ("Ara", "Kirala", "Teklif İste"). Fiyatlar para biriminin kendi simgesiyle yazılır: `₺1.250` (İngilizcede `₺1,250`), `€36,40`, `$36.40`. Tam tutar ondalıksız, kuruşlu ya da centli tutar her zaman iki ondalıkla gösterilir; tutar ekranda yuvarlanmaz, böylece rezervasyon özetindeki kalemler toplamla tutmaya devam eder. API her tutarı para birimiyle birlikte alt birim tam sayısı olarak gönderir (`{ "amount": 125000, "currency": "TRY" }` = ₺1.250), biçimlendirme `lib/price.ts` içindedir. Tarihler `12 Eki 2026`.
- **Metin bütçesi:** Kart açıklaması en fazla 2 satır (~120 karakter). Ürün/hizmet özeti en fazla 40 kelime; uzunu detay sayfasına.
- **Sürdürülebilirlik:** Hakkımızda'da ayrı bölüm. Her iddia ölçülebilir olmalı (filodaki elektrikli/hibrit oranı, yıllık CO₂ tasarrufu, geri dönüştürülen lastik sayısı, kağıtsız tutanak). Rakamlar kurgusal ama tutarlı tutulur (§4.1).
- **Ürün ve hizmet içeriği:** Ek A. Metinler şimdilik çeviri dosyalarında durur; aynı metin backend seed'ine de girer, API'ye bağlama BACKLOG Y5'te (ADR-17).
- **Yasal metinler:** Kurgusal. KVKK aydınlatma metni, gizlilik politikası, çerez politikası, kullanım şartları ve kiralama koşulları ayrı sayfalardır. Kişisel veri toplayan her form aydınlatma metnine bağlanan bir onay kutusu taşır.

### 4.1 Rakamlar (tek kaynak)

Kurgusal şirket; rakamlar G'nin izniyle tutarlı olacak şekilde seçildi. Sitede, örnek veride ve seed'de aynı rakamlar kullanılır.

| Rakam | Değer | Nerede |
|---|---|---|
| Kuruluş | 2012 (2026'da 14 yıl) | Hakkımızda sayacı, zaman çizelgesi |
| Bayi ağı | 14 şehirde 15 bayi (İstanbul'da 2) | Hakkımızda sayacı ("şehirde bayi"), zaman çizelgesi, örnek veri, seed |
| Filo | 15 araç modeli; her model 1–4 bayide | Hakkımızda sayacı ("araç modeli"), Araçlarımız, örnek veri, seed |
| Kurumsal müşteri | 4.200 | Hakkımızda sayacı |
| Elektrikli / hibrit | Filonun %18'i (oran korunur) | Sürdürülebilirlik |

- G'nin mesajındaki "15 araçlık filo" ile "4.200 kurumsal müşteri" yan yana inandırıcı durmadığı için filo **15 araç modeli** olarak yazılır. Sitede araç sayısı verilmez.
- Sürdürülebilirlik metinlerinde "4.200 araçlık filo" ifadesi kalkar (4.200 artık kurumsal müşteri sayısı); oranlar ve yıllık rakamlar korunur. Zaman çizelgesindeki "15 şehirde" → "14 şehirde".
- Hakkımızda'daki dört sayaç kalır (yıl, şehir, model, kurumsal müşteri); hiçbiri kaldırılmaz.

---

## 5. Tasarım yönü

> G'nin yönlendirmesi: marka rengi doğa yeşili; tipografi modern ve kurumsal; sade ve net ama düz değil; orantılı boşluklar; akılda kalacak öğe güven odaklı. 10 Ekim: v0.3 paleti "yapay zekâ tarzı" bulundu; yeşil kalarak renk teorisine uyan, daha doğal bir palet seçildi (§5.1) ve sayfa zemini varsayılan olarak beyaz oldu.

### 5.1 Renk

**Palet: Zeytin ve Ege (v0.4, G'nin seçimi, 10 Ekim 2026).** v0.3'teki krem kâğıt zemin, terrakota vurgu ve koyu temadaki parlak nane yeşili, yapay zekâ üretimi arayüzlerin en tanıdık kalıbıydı; site "hazır şablon" gibi okunuyordu. Yeni palet Anadolu manzarasından geliyor: zeytin yeşili, kireçtaşı nötrler ve Ege mavisi.

**Ana renk: zeytin `#45561D`.** Sarıya çekik, doygunluğu düşük bir yeşil. Hem doğa vurgusunu (SPEC'in ilk kararı) hem güveni taşır; beyaz üzerinde 8.1:1, yani buton zemini ve metin olarak kullanılabilir.

**Nötrler: kireçtaşı.** Grilere çok az zeytin karışır; metin ve çizgiler markanın ailesinden olur ama renkli görünmez. **Sayfa zemini beyazdır** (G'nin kararı); derinlik kireçtaşı paneller (`stone-100`) ve ince çizgilerle verilir.

**Vurgu: Ege mavisi `#1C6A8A`.** Renk çemberinde zeytinin karşı tarafına yakın (ayrık tamamlayıcı uyum). Yalnızca öne çıkması gereken birkaç şeyde kullanılır: "En çok tercih edilen" rozeti, küçük işaretler, koyu banttaki vurgu. Butonlar zeytin kalır.

| Token | Hex | Kullanım |
|---|---|---|
| `olive-950` | `#1A1C16` | Ana metin |
| `olive-900` | `#262B1B` | Koyu bant (Yol Boyu Güvence) |
| `olive-800` | `#323F13` | Seçili durumda metin |
| `olive-750` | `#384717` | Birincil buton hover |
| `olive-700` | `#45561D` | **Ana marka rengi**, birincil buton, link, odak halkası |
| `olive-600` | `#566B25` | Koyu temada birincil buton |
| `olive-500` | `#627A2B` | Koyu temada buton hover |
| `olive-300` | `#B5C97E` | Koyu temada link, odak, vurgu metni |
| `olive-100` | `#E5EBD3` | Seçili durum zemini, metin seçimi |
| `stone-700` | `#4A4D40` | İkincil metin |
| `stone-600` | `#62655A` | Yardımcı metin, placeholder |
| `stone-500` | `#868979` | Form kenarlığı (beyaz üzerinde 3.58:1, WCAG 1.4.11 için en az 3:1) |
| `stone-300` | `#DCDCD3` | Ayırıcı çizgi, kart kenarlığı |
| `stone-100` | `#F3F3EF` | Hafif bölüm ve panel zemini |
| `stone-50` | `#EEEFE8` | Koyu zeminde metin |
| `white` | `#FFFFFF` | Sayfa, kart ve form zemini |
| `aegean-700` | `#1C6A8A` | Vurgu (ikon, nokta, çizgi) |
| `aegean-900` | `#154F67` | Vurgu zemininde metin |
| `aegean-300` | `#8FC3DA` | Koyu zeminde vurgu |
| `aegean-100` | `#DCEEF5` | Vurgu rozet zemini |
| `error` | `#B42318` | Hata |
| `warning` | `#9A6700` | Uyarı |
| `success` | `olive-700` | Başarı (marka rengiyle aynı, ayrı yeşil eklenmez) |

**Ölçülen kontrastlar (WCAG):** beyaz/`olive-700` 8.07 · beyaz/`olive-750` 10.09 · `olive-950`/beyaz 17.19 · `stone-700`/`stone-100` 7.78 · `stone-600`/beyaz 5.95 · `stone-600`/`stone-100` 5.35 · `aegean-900`/`aegean-100` 7.50 · beyaz/`aegean-700` 6.04 · `stone-50`/`olive-900` 12.57 · `aegean-300`/`olive-900` 7.61 · `error`/beyaz 6.57 · `warning`/beyaz 4.87. Hepsi AA (4.5:1) üstünde; kenarlık 3:1 üstünde.

**Koyu tema** (kullanıcı seçerse ya da "sistem" seçilip sistem koyuysa): zemin `#13140F`, kart `#1C1E17`, metin `stone-50`, birincil buton `olive-600`, link ve odak `olive-300`, vurgu `aegean-300`. Ölçülen: metin/zemin 15.99 · ikincil metin `#BBBEAF` 9.78 · yardımcı metin `#979A8B` 6.44 · link 10.24 · beyaz/`olive-600` 5.96 · beyaz/`olive-500` (hover) 4.84 · form kenarlığı `#757968` kart üzerinde 3.76. Saf siyah kullanılmaz. Değerlerin tamamı `apps/web/app/globals.css` içinde.

**Tarayıcı yüzeyleri:** metin seçimi (`olive-100` üzerinde `olive-800`), imleç ve form kontrollerinin vurgu rengi paletten gelir; tarayıcı varsayılanında kalmaz.

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
- **Gölge:** neredeyse yok. Derinlik gölgeyle değil zemin tonu farkıyla (paper → beyaz kart) verilir; sadece açılan menülerde, pencerelerde ve arama alanında hafif gölge.
- **Kırılma noktaları:** 375 (tasarım buradan başlar) · 768 · 1280.

### 5.4 Yerleşim konsepti: "sade, ama düz değil"

- Sadelik az öğeden gelir: her bölümün tek bir görevi ve tek bir birincil butonu var.
- "Düz değil" hissi ritimden gelir, süsten değil:
  - Bölümler her zaman ortalanmış değil; metin solda / görsel sağda, sonraki bölümde tam genişlik, sonra koyu bant. Göz her bölümde aynı kalıba alışmaz.
  - Sayfa akışında bir kez **koyu zeytin bant** (`olive-900`) kullanılır: Yol Boyu Güvence bölümü. Açık sayfada tek koyu bölüm, dikkati oraya toplar.
  - Büyük, kenarları yuvarlatılmış fotoğraflar; araç fotoğraflarında doğal ışık ve açık hava.
- **Hareket:** varsayılan olarak yalnızca durum değişikliğini anlatan geçişler (anahtar değişince alanın yumuşak geçişi, pencere açılıp kapanması). Kaydırınca beliren dekoratif animasyon yok.
  - **İstisnalar (v0.3, G'nin onayı):** iş birlikleri şeridi (sürekli akış, durdurma düğmeli), Hakkımızda sayaçları (görününce bir kez sayar), Hikayemiz zaman çizelgesi (seçim değişince geçiş), SSS'nin yaylı açılması, galeri slayt geçişi.
  - Kendiliğinden başlayan bir geçiş yok: galeri ve zaman çizelgesini kullanıcı ilerletir.
  - `prefers-reduced-motion` açıksa hareketli her şey durur ya da anında geçer.

### 5.5 Akılda kalacak tek öğe: Yol Boyu Güvence

Hakkımızda metnindeki "Sadece Araç Kiralamıyoruz, Yol Boyu Güvence Sunuyoruz" cümlesi markanın güven vaadi. Bu vaat sitede **somut bir bileşene** dönüşür:

- **Ana sayfada:** iş birliklerinden sonra, koyu yeşil bantta, bir aksilik anının senaryosu olarak anlatılır: *Yolda kaldın → tek dokunuşla SOS → GPS ile en yakın çekici yönlendirilir → 7/24 operasyon masası seni arar → arıza 24 saati aşarsa yedek araç kapında.* İkon kartları değil, soldan sağa (mobilde yukarıdan aşağı) ilerleyen tek bir zaman çizgisi.
- **Karar anlarında tekrar:** rezervasyon özetinde ve ödeme ekranında aynı güvencenin kısa bir şerit hâli ("Bu kiralama Yol Boyu Güvence kapsamında: 7/24 destek, çekici, yedek araç"). Kullanıcı tam para öderken güven mesajını görür.
- **Şeffaf fiyat:** rezervasyon özetinde tüm kalemler açık yazılır, "gizli ücret yok" ibaresi. Güven sadece söylenmez, fiyat ekranında gösterilir.

### 5.6 Kaçınılacaklar

Eşit üç sütunlu ikon+başlık+gri metin kartları, gerekçesiz gradient, sırası olmayan içeriğe 01/02/03, her bölümde aynı ortalanmış yerleşim, amaçsız animasyon, saf siyah metin, saf gri nötrler.

### 5.7 Erişilebilirlik

WCAG 2.2 AA. Metin kontrastı en az 4.5:1, dokunma hedefi en az 44×44px, görünür odak halkası (`olive-700`, koyu temada `olive-300`; 2px, 2px boşluk), tüm akışlar klavyeyle tamamlanabilir, anahtar (Bireysel/Kurumsal) ekran okuyucuda seçili durumu bildirir. Hareketli bileşenler durdurulabilir ve `prefers-reduced-motion`'a uyar (§5.4). Pencereler odağı içeride tutar, Esc ile kapanır ve kapanınca odağı açan öğeye geri verir.

---

## 6. Medya envanteri

Fotoğraf kaynağı kararı açık (§10); o zamana kadar tüm fotoğraflar yer tutucu.

| Tür | Kullanım yeri | Kaynak | Lisans | Adet | En-boy | Bütçe |
|---|---|---|---|---|---|---|
| Kampanya görseli | Ana sayfa galerisi | Stok veya üretilmiş | Kontrol edilecek | 3–4 | 16:9 masaüstü, 4:5 mobil | ≤200 KB (ilki LCP, öncelikli) |
| Araç fotoğrafı | Arama sonuçları, Araçlarımız kartı ve penceresi | Telifsiz stok veya üretici basın fotoğrafı | Kontrol edilecek | 15 (model başına 1) | 16:10 | ≤120 KB/adet (WebP/AVIF) |
| Ürün görselleri | Ürün kartları ve detay | Stok | Kontrol edilecek | 4 | 3:2 | ≤150 KB |
| Hikayemiz görselleri | Hakkımızda zaman çizelgesi | Stok | Kontrol edilecek | 6 | 3:2 | ≤120 KB |
| Genel merkez fotoğrafı | İletişim | Stok | Kontrol edilecek | 1 | 3:2 | ≤150 KB |
| İkonlar | Hizmetler, özellikler | Açık kaynak ikon seti | MIT/ISC | ~30 | 1:1 SVG | Satır içi SVG |
| İş ortağı logoları | Ana sayfa şeridi | Kurgusal, Claude üretir | — | 8 | Serbest, SVG | ≤10 KB/adet |
| Logo | Header, footer, favicon | Ekip üretecek | — | 1 set | SVG | — |
| Paylaşım görseli | Open Graph | Kodla üretilir | — | 1 | 1200×630 | — |
| Harita | İletişim | Google Maps JavaScript API (backend tarafı kuracak) | Google Maps Platform şartları | — | — | Harita kütüphanesi sadece İletişim sayfasında yüklenir |

---

## 7. Veri (backend ile ortak sözleşmenin girdisi)

Ayrıntılı API kontratı `docs/api/openapi.yaml`'da yazılacak (BACKLOG #6). Temel varlıklar:

`User`, `Branch` (bayi: ad, şehir, adres, koordinat, telefon, e-posta, çalışma saatleri), `VehicleClass`, `Vehicle`, `Extra` (ek hizmet: çocuk koltuğu, ek sürücü vb.), `Reservation`, `QuoteRequest`, `ContactMessage` (iletişim formu, v0.3), `FaqItem`, `Product`, `Service`, `ExchangeRate` (kur: para birimi, TRY'ye oran, güncellenme zamanı).

v0.3 ekleri:

- **Model ve fiziksel araç:** Araçlarımız modeli gösterir (pencere adresi model slug'ı taşır), arama sonuçları belirli bir bayideki fiziksel aracı. Model düzeyinde slug, iki dilli kısa açıklama ve **yakıt tüketimi** (değer + birim: L/100 km veya kWh/100 km) gerekir. Şema önerisi ARCHITECTURE'daki "Backend ile netleşecekler" listesinde.
- **Kampanyalar, iş ortağı logoları, genel merkez ve departman e-postaları:** şimdilik frontend'de sabit içerik. Kampanyaların API'ye taşınması açık karar (§10).
- **QuoteRequest alanları** kurumsal kutunun tasarımı onaylanınca netleşir.

Ürün ve hizmet içeriği API'den gelir, iki dilli alanlarla (ADR-17). Tutarlar `{ amount, currency }` olarak, para biriminin alt birimi cinsinden tam sayıyla taşınır (ADR-15). Zamanlar ISO 8601 UTC'dir, ekranda `Europe/Istanbul` ile gösterilir (ADR-16).

---

## 8. Uçtan uca doğrulama

v1 "bitti" sayılmadan önce, 375px genişlikte mobil tarayıcıda:

1. Ana sayfada Bireysel seçili; bayi ve tarih seçilip **Ara**'ya basılır.
2. Sonuçlarda bir araçta **Kirala**'ya basılır.
3. Özette bir ek hizmet seçilir, toplam doğru görünür; giriş yapılır; sahte ödeme ekranı geçilir; onay sayfasında rezervasyon numarası görünür.
4. Profil > Rezervasyonlarım'da bu rezervasyon listelenir.
5. Ana sayfada Kurumsal'a geçilir; form doldurulup gönderilir; "Talebiniz alındı" görünür.
6. Araçlarımız'da bir karta tıklanır; pencere açılır, modelin bayileri görünür; Esc ile kapanır, odak karta döner.
7. İletişim'de şehir filtresinden "İzmir" seçilir; liste ve pinler daralır. İletişim formu gönderilir.
8. Çerez bandında "Reddet" seçilir; analytics yüklenmez.
9. Aynı akışlar 1280px masaüstünde ve yalnızca klavyeyle tekrarlanır.

---

## 9. Kalite gereksinimleri (v0.3)

G'nin 9 Ekim tarihli öneri dosyasından gelen ek maddeler (dil eşlemesi, Open Graph, yapılandırılmış veri, 500 sayfası, Core Web Vitals hedefi, manifest, güvenlik başlıkları) G tarafından 10 Ekim'de onaylandı.

| Gereksinim | Kabul ölçütü |
|---|---|
| SEO | Herkese açık her sayfada benzersiz başlık ve meta açıklama, canonical URL, TR/EN dil eşlemesi (hreflang, `x-default` = TR), Open Graph başlık/açıklama/görsel. Yapılandırılmış veri: tüm sitede `Organization`, İletişim'de her bayi için `AutoRental` |
| `robots.txt` | Yalnızca `/api/` engellenir; site haritası belirtilir. Dizine girmemesi gereken sayfalar `noindex` ile çıkarılır, robots.txt ile engellenmez (engellenen sayfanın `noindex`'i okunamaz) |
| `noindex` | Giriş, kayıt, şifre sıfırlama, profil, arama sonuçları, rezervasyon özeti, ödeme, onay, 404, 500 |
| `sitemap.xml` | Herkese açık tüm sayfalar, iki dilde, dil eşlemesiyle |
| Görsel alt metinleri | Anlamlı görselde açıklayıcı alt metin (çeviri dosyasında); dekoratif görselde `alt=""` |
| Gizlilik politikası, kullanım şartları | Ayrı sayfalar; footer'dan erişilir |
| Çerez onayı | Kabul et / Reddet / Ayarlar eşit ağırlıkta; zorunlu olmayan hiçbir şey onaysız yüklenmez; tercih footer'daki "Çerez tercihleri"nden değiştirilebilir (ADR-19) |
| Analytics | Çerez kullanmayan bir araç, yalnızca onayla yüklenir (ADR-19) |
| Net CTA | Her bölümde tek birincil buton (§5.4); ana sayfada birincil eylem "Ara" |
| Responsive | 375 / 768 / 1280 px'te doğru; yatay kaydırma yok |
| Formlar | Backend uçlarıyla gerçekten gönderilir; alan bazlı hata; başarı durumu; KVKK onay kutusu; gizli tuzak alanla spam koruması (ADR-20) |
| Kırık link kontrolü | CI'da her PR'da iç linkler kontrol edilir |
| Site hızı | Core Web Vitals hedefi (mobil): LCP < 2,5 sn, INP < 200 ms, CLS < 0,1. Galerinin ilk görseli öncelikli |
| Erişilebilirlik | WCAG 2.2 AA (§5.7) |
| SSS | Ana sayfada (§2.2.5) |
| 404 ve 500 | Markalı, ana sayfaya dönüş; 500'de tekrar dene |
| Favicon | Favicon, Apple ikonu, web manifest ve `theme-color` |
| `llms.txt` | Sitenin kısa tanımı ve herkese açık sayfa listesi. Not: resmi bir standart değil, SEO etkisi beklenmez |
| Güvenlik başlıkları | CSP, HSTS (canlıda), `X-Content-Type-Options`, `Referrer-Policy` |

Sonraya bırakılanlar (G onayladı): breadcrumb, Lighthouse CI.

---

## 10. Açık kararlar

| Karar | Kimde | Not |
|---|---|---|
| Kurumsal kutunun tasarımı; `/kurumsal-teklif` sayfasının ana sayfa formuyla ilişkisi | G | Claude, uygulamadan önce öneri getirir |
| Fotoğraf kaynağı (stok / üretilmiş / yer tutucu) | G | Galeri, araçlar, Hikayemiz, genel merkez |
| Analytics aracı: Vercel Web Analytics veya Umami | G | Yayın ortamına bağlı (ADR-12, ADR-19); ücretsiz plan koşulları doğrulanmadı |
| Kampanya içeriği sabit mi, API'den mi | İKİ | Şimdilik sabit |
| Yayın ortamı ve alan adı | İKİ | Canonical, sitemap ve görsel alan adı buna bağlı |

---

## Ek A. Ürün ve hizmet içeriği (G, 9 Ekim 2026)

İçerik G'nin mesajından aynen alınmıştır. İngilizce karşılıklarını Claude çevirir. Slug'lar iki dilde aynıdır.

### Ürünlerimiz

**1. Akıllı Kurumsal Filo Kiralama** · `akilli-kurumsal-filo` · *En çok tercih edilen*
- **Konsept:** Şirketinize son model araç filosu tahsis ederken, arkasında tüm filoyu yöneteceğiniz Merkezi Admin Panelini hediye ediyoruz.
- **Ne Alıyorsunuz?** Şirketinizin ihtiyacına uygun (binek, SUV, ticari veya hibrit) uzun dönem kiralık araç filosu.
- **Teknolojik Artısı (Dahili Panel):**
  - Novera Admin Paneli Dahil: Araçların hangi personele zimmetli olduğunu, sözleşme sürelerini, faturaları ve HGS masraflarını tek tıkla takip edin.
  - Canlı GPS ve Telematik: Kiralanan araçların hız, kontak durumu, rota geçmişi ve yakıt tüketimini canlı haritadan izleyin.
  - Masraf ve ceza takibini otomatikleştiren şirket yönetim arayüzü.

**2. Yönetici ve Premium Araç Kiralama (VIP Mobilite)** · `vip-mobilite`
- **Konsept:** Üst düzey şirket yöneticileri ve kurumsal konuklar için lüks segment, tam donanımlı ve öncelikli mobilite çözümü.
- **Ne Alıyorsunuz?** E ve F segmenti prestij araçlar (Audi, BMW, Mercedes vb.), opsiyonel VIP şoför desteği.
- **Teknolojik Artısı:**
  - Öncelikli Mobil Konsiyerj: Sürücüye ve yöneticiye özel VIP destek hattı.
  - Hızlı Transfer ve Şoför Koordinasyonu: Mobil arayüz üzerinden karşılama, rota optimizasyonu ve uçuş takibi.

**3. Esnek & Kısa Dönem Araç Kiralama (KOBİ ve Bireysel)** · `esnek-kisa-donem`
- **Konsept:** Proje bazlı işler, acil saha ihtiyaçları veya dönemsel seyahatler için taahhütsüz, hızlı teslimatlı kiralama.
- **Ne Alıyorsunuz?** Günlük, haftalık veya aylık periyotlarla son model araçlar.
- **Teknolojik Artısı (Sürücü Uygulaması):**
  - Novera Driver App: Anahtarı teslim alırken çizik/hasar kaydını telefondan fotoğraflayıp dijital tutanak tutabilme.
  - Uygulama İçi SOS Butonu: Olası bir aksilikte tek tuşla konumu merkeze iletip yardım çağırabilme.

**4. Yeşil Filo (Elektrikli & Hibrit Araç Kiralama)** · `yesil-filo`
- **Konsept:** Karbon ayak izini azaltmak isteyen kurumsal şirketler için sürdürülebilir yeni nesil filo çözümü.
- **Ne Alıyorsunuz?** En güncel elektrikli ve hibrit araç parkı.
- **Teknolojik Artısı:** Panel üzerinden anlık batarya sağlığı, şarj istasyonu durumu ve şirketinize sağladığı karbon emisyon tasarrufu raporlaması.

### Servislerimiz

Her hizmete Claude 3 kısa madde ekler (§2.5).

- **Akıllı Yol Yardım & Çekici:** Kaza/arıza anında GPS koordinatınıza en yakın anlaşmalı çekiciyi canlı yönlendirme.
- **7/24 Canlı Operasyon Masası:** Sürücülerin uygulama veya telefon üzerinden anında bağlanabildiği kriz yönetimi.
- **Kesintisiz İkame (Yedek) Araç:** Arıza 24 saati aştığında işin durmaması için kapınıza gelen eşdeğer yedek araç.
- **Periyodik Bakım & Lastik Oteli:** Yaz/kış lastiği değişimi, muayene takibi ve adresten vale ile servis hizmeti.
- **Novera SOS & Acil Durum Müdahale:** Tek dokunuşla tüm acil müdahale birimleri canlı konumunuzda.
