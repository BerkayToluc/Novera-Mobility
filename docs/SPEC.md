# Novera Mobility: Ürün Tanımı (SPEC)

> Durum: **Taslak v0.8** · 15 Ekim 2026 (v0.8: G'nin 15 Ekim kararları: 1 puan = ₺5, sürücü kuralı 18 yaş ve geçerli ehliyet, sonuç kartlarında toplam fiyat önce ve 100 km yakıt, liste/ızgara görünümü, İletişim'de Yardım kartı, profilin yenilenmesi; §2.3, §2.6, §2.9, §2.10) · v0.7: 14 Ekim 2026 (v0.7: G'nin 13-14 Ekim kararları: Framer bileşenleriyle navbar, şerit, güvence bandı, SSS, footer, e-posta bağlantıları; ürün sayfaları; sonuç filtresi, puanla ödeme, özet fiyat satırları ve KDV, kampanya kodunun özete taşınması; §2.2, §2.3, §2.5, §2.6, §2.7, §2.8, §5.4, §5.6) · v0.6: 12 Ekim 2026 (v0.6: G'nin 12 Ekim ana sayfa rötuşları: kurumsal süre 1/2/3 ay, bayi satırında çalışma durumu, tek sütun araç kartı ve fiyat bloğu, durdur düğmesi yerine kullanıcı başlatan şerit, güvence bandında akan çizgi, mağaza işaretleri, oklu rehber kaydırıcı, konu sekmeli SSS; §2.2, §2.4, §2.9, §5.4) · v0.5: 11 Ekim (v0.4: 10 Ekim, v0.3: 9 Ekim, v0.2: 4 Ekim 2026). v0.5: G'nin 11 Ekim navbar ve sayfa düzeni geri bildirimi (yüzen hap navbar, Bayilerimiz sayfası, filonun ana sayfaya taşınması; §2.1, §2.4, §2.6, §2.8, §5.3, §8)
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
| Ana sayfa (Araç Kirala) | `/` | `/en` | Kampanya galerisi, Bireysel / Kurumsal kiralama kutusu, **araçlarımız bölümü (v0.5)**, iş birlikleri, Yol Boyu Güvence, SSS (§2.2) |
| Arama sonuçları | `/araclar` | `/en/cars` | Seçilen bayide ve tarihlerde uygun araçlar; fotoğraf, bilgi, fiyat ve **Kirala** butonu. Üstte düzenlenebilir arama (§2.3) |
| ~~Araçlarımız~~ | ~~`/araclarimiz`~~ | ~~`/en/our-cars`~~ | **Kaldırıldı (v0.5):** filo ana sayfada bir bölümdür (§2.4); eski adrese yönlendirme eklenmez, site yayında değil |
| Bayilerimiz | `/bayilerimiz` | `/en/branches` | Bayi listesi, şehir filtresi, arama ve harita; İletişim'den taşındı (v0.5, §2.6.1) |
| ~~Araç detay~~ | ~~`/araclar/:slug`~~ | ~~`/en/cars/:slug`~~ | **Kaldırıldı (v0.3):** araç bilgisi kartta ve Araçlarımız penceresinde; Kirala doğrudan rezervasyon özetine gider, ek hizmet seçimi özete taşındı |
| Rezervasyon özeti | `/rezervasyon` | `/en/booking` | Tarih, lokasyon, **ek hizmet seçimi**, kalem kalem fiyat, toplam |
| Ödeme (sahte) | `/odeme` | `/en/payment` | Gerçek ödeme alınmaz |
| Rezervasyon onay | `/rezervasyon/onay` | `/en/booking/confirmation` | Rezervasyon numarası |
| Ürünler | `/urunler` | `/en/products` | 4 ürün; "En çok tercih edilen" öne çıkar (içerik Ek A) |
| Ürün detay | `/urunler/:slug` | `/en/products/:slug` | Konsept, Ne Alıyorsunuz, Teknolojik Artısı + "Teklif Al" |
| Hizmetler | `/hizmetler` | `/en/services` | 5 hizmet, açılır-kapanır yapı (içerik Ek A) |
| Hakkımızda | `/hakkimizda` | `/en/about` | Hikayemiz (eğri zaman çizelgesi), rakamlar (sayaç), misyon/vizyon, sürdürülebilirlik (§2.7) |
| İletişim | `/iletisim` | `/en/contact` | Genel merkez, departman e-postaları, iletişim formu ve Bayilerimiz'e bağlantı (§2.6) |
| Kurumsal teklif | `/kurumsal-teklif` | `/en/corporate-quote` | Ürün sayfalarındaki "Teklif Al" buraya gelir; navbar'da link yok. Ana sayfadaki kurumsal kutuyla ilişkisi açık karar (§10) |
| Giriş / Kayıt / Şifremi unuttum | `/giris`, `/kayit`, `/sifre-sifirla` | `/en/login`, `/en/register`, `/en/reset-password` | Girişte **Bireysel** ve **Kurumsal** sekmeleri (v0.4, §2.9) |
| Profil | `/profil` | `/en/profile` | Alt sekmeler, her biri kendi sayfası: Hesabım (`/profil`), Rezervasyonlarım (`/profil/rezervasyonlar`, `/en/profile/bookings`; yaklaşan ve geçmiş seyahatler ayrı), Puanlarım (`/profil/puanlar`, `/en/profile/points`, v0.4), Ayarlar (`/profil/ayarlar`, `/en/profile/settings`; varsayılan para birimi, dil, tema). Kurumsal hesapta sekmeler farklıdır (§2.9). Giriş yapılmamışsa "giriş yapın" bildirimi gösterilir |
| Yasal | `/kvkk`, `/cerez-politikasi`, `/kiralama-kosullari`, `/gizlilik-politikasi`, `/kullanim-sartlari` | `/en/privacy-notice`, `/en/cookie-policy`, `/en/rental-terms`, `/en/privacy-policy`, `/en/terms-of-use` | Kurgusal metin. KVKK aydınlatma metni ile gizlilik politikası ayrı belgelerdir (v0.3) |
| Araç kiralama rehberleri | `/rehberler`, `/rehberler/:slug` | `/en/guides`, `/en/guides/:slug` | Kısa rehber yazıları; ana sayfada kartlarla (v0.4, §2.9) |
| Yardım | `/yardim` | `/en/help` | İletişim'den ayrı yardım merkezi (v0.4, §2.9) |
| 404 | — | — | Markalı, ana sayfaya dönüş |
| 500 | — | — | Markalı hata sayfası: tekrar dene + ana sayfa (v0.3) |

İngilizce yolları ADR-04 gereği `/en` altında çevrilmiştir (ör. `/araclar` ↔ `/en/cars`); eşleme `apps/web/i18n/routing.ts` içindedir.

### 2.2 Ana sayfa

Yukarıdan aşağıya bölüm sırası:

| # | Bölüm | Not |
|---|---|---|
| 1 | Kampanya galerisi | §2.2.1 |
| 2 | Kiralama kutusu | Sayfanın `h1`'i ("Araç Kirala") bu bölümün başlığıdır ve **ortalanır**. Altında, yine ortalı, yalnızca iki buton: **Bireysel** / **Kurumsal**; butonların çevresinde kutu ya da çerçeve yok (v0.4, G). Altında form (§2.2.2, §2.2.3) |
| 3 | Nasıl çalışır? | Üç adım: bayi ve tarihi seçin, aracı kiralayın, teslim alıp yola çıkın; yalnızca Bireysel sekmede (v0.6, G) |
| 4 | Araçlarımız (filo) | Kategori çipleri ve seçili kategorideki modeller; yalnızca Bireysel sekmede (v0.5, G; §2.4) |
| 5 | İş birlikleri | Kayan logo şeridi (§2.2.4) |
| 6 | Yol Boyu Güvence | Koyu zeytin bant, modernleştirilmiş (§5.5) |
| 7 | Mobil uygulama | Uygulama reklamı: fotoğraf solda, metin ve mağaza rozetleri sağda (v0.4, G; §2.9) |
| 8 | Araç kiralama rehberleri | Oklarla kaydırılan rehber kartları; "Tüm rehberler" düğmesi yok, liste footer'dan ve Yardım'dan açılır (v0.6, G; §2.9) |
| 9 | Sık sorulan sorular | §2.2.5 |
| 10 | Footer | §2.8 |

v0.2'deki kitleye göre değişen "araç sınıfları" ("Size uygun sınıfı seçin") ve "4 ürün" bölümleri kaldırıldı (G'nin kararı, 10 Ekim'de yinelendi). `h1` galeride değil kutuda durur, çünkü galeri kampanya içeriğidir, sayfanın konusu araç kiralamaktır.

#### 2.2.1 Kampanya galerisi

- 3–4 slayt. Her slaytta görsel, başlık, kısa metin ve tek bir CTA. Metinler çeviri dosyasında.
- **Otomatik geçiş yok.** Geçiş oklar, noktalar ve kaydırmayla (dokunmatikte sürükleme) yapılır; klavyeyle kullanılabilir.
- **Oklar fotoğrafın içinde (v0.7, G):** alttaki iki düğme kalktı. Sol ok kartın en solunda, sağ ok en sağında, kartın boydan boya yüksekliğinde buzlu bir şerit (`backdrop-blur`) olarak durur; üzerinde yuvarlak beyaz bir ok vardır. Fare ve klavye ile galeriye gelince görünür (hover'ı olmayan dokunmatik cihazlarda hep görünür); metin sütunu sol şeride yer bırakır. Noktalar altta kalır.
- İlk slaytın görseli sayfanın en büyük görselidir (LCP); öncelikli yüklenir, diğerleri tembel yüklenir.
- Görseller fotoğraf kararına kadar yer tutucu (§10). İçeriğin sabit mi API'den mi geleceği açık karar; şimdilik sabit.

#### 2.2.2 Bireysel (varsayılan)

- Alış bayisi, bırakılacak bayi, tarih aralığı (tek takvim) ve alış/iade saati (30 dakikalık dilimler, ADR-16) → **Ara** → `/araclar`.
- **Konumumu kullan (v0.6, G):** alış bayisinin altında bir düğme; basılınca tarayıcı konum izni ister, en yakın bayi (kuş uçuşu) seçilir ve ne kadar uzakta olduğu yazılır. Konum yalnızca o an kullanılır, hiçbir yere kaydedilmez; izin verilmezse ya da alınamazsa bayi listeden seçilir.
- **Bayi listesi (v0.6, G):** her bayinin adının altında **çalışma durumu** yazar: "7/24 açık", "Şu an açık, 20:00'ye kadar" ya da "Kapalı, yarın 09:00'da açılır" (Türkiye saatine göre, liste açılınca hesaplanır). Aracın adları artık görünmez; araç sonuç sayfasında seçilir.
- Bırakılacak bayi her zaman seçilir; kullanıcı dokunmadıkça alış bayisini izler (çoğu kiralama başladığı yerde biter).
- Arama formunda **araç seçilmez**; araç, sonuç sayfasında seçilir.

#### 2.2.3 Kurumsal

- Gerekçe (G): kurumsal müşteri bireysel gibi kendi başına rezervasyon yapmaz. Araçlar istenen yere götürülür ve istenen yerden geri alınır, fiyat buna göre değişir; ayrıca birden fazla araç seçilebilir. Bu yüzden akış **form + görüşme**: müşteri bilgilerini bırakır, satış ekibi arar.
- Bu kısım profesyonel görünmelidir. **Tasarım (G onayladı, 10 Ekim):** tek adım. Kurumsal seçilince kutuda önce "Nasıl ilerliyor?" şeridi (formu gönderin → satış ekibi bir iş günü içinde arar → size özel teklif), sonra talep formu: firma adı, yetkili ad soyad, iş e-postası, telefon, araç sayısı (1–5 / 6–20 / 21–50 / 50+), süre (1 / 2 / 3 / 6 / 12 / 24 / 36+ ay; v0.6), ihtiyaç türü (birden fazla seçilebilen çipler: binek, SUV, ticari, elektrikli/hibrit, premium), teslim şehirleri, not, KVKK onayı. Gönderince aynı yerde "Talebiniz alındı" ve talep numarası. `/kurumsal-teklif` aynı formu kullanır; ürün sayfalarındaki "Teklif Al" oraya ürünü önceden seçili getirir (`?urun=`). Kişisel bilgiler adreste taşınmaz.
- Form KVKK onay kutusu ve spam koruması taşır (§9); gönderince "Talebiniz alındı" durumu gösterilir.
- Seçim URL'de tutulur (`/?tip=kurumsal`), link paylaşılınca aynı seçim açılır. Seçim yalnızca kutuyu ve SSS'nin açık sekmesini değiştirir; sayfanın geri kalanı iki kitle için aynıdır.

#### 2.2.4 İş birlikleri

- 8 kurgusal şirket logosu (SVG). Gerçek marka logosu kullanılmaz.
- Görsel ve davranış referansı: Framer "InfiniteLogoMarquee". Logolar gri ve soluktur, üzerine gelince renklenir ve hafifçe büyür. **Şerit kendiliğinden akar, üzerine gelince durur (v0.7, G; v0.6'daki "kendiliğinden akmaz" kararı geri alındı):** Framer "Logo 3D Carousel" davranışı: logolar sola doğru süzülür, ortada büyür (en çok 1,25 kat), kenarlara doğru küçülür, solar ve hafifçe bulanıklaşır (en çok 2 px); kenarlar maskelenir. Fare üzerine gelince ya da klavye odağı şeride girince yumuşakça yavaşlayıp durur, ayrılınca devam eder. Yatay sürüklenebilir. Ekranda değilken çalışmaz.
- **Durdur / Oynat düğmesi kalktı (v0.6):** hareket kendiliğinden başlamadığı, kullanıcının üzerine gelmesi ya da odaklamasıyla başladığı için WCAG 2.2.2 (beş saniyeden uzun otomatik hareket) sorun olmaz. **WCAG 2.2.2 notu (v0.7):** şerit kendiliğinden hareket eder; üzerine gelince ya da odaklanınca durması ve sürüklenebilmesi hareketi kullanıcının denetimine verir, ama fare ya da klavye kullanamayan biri için ayrı bir durdurma düğmesi yoktur; G bunu bilerek kabul etti. Şerit klavyeyle odaklanabilir (`tabindex=0`, adlı grup). `prefers-reduced-motion` açıksa şerit hiç hareket etmez, logolar ortada büyüyerek sabit durur.
- Ekran okuyucu logoları bir kez okur; döngü için tekrarlanan kopyalar gizlidir.

#### 2.2.5 Sık sorulan sorular

- **v0.6 (G):** kategori sekmeli SSS bileşeni (sekmede kayan dolgu animasyonu, satırda dönen artı simgesi, `framer-motion`); altta iletişim çağrısı.
- Sekmeler **konulardır** (Rezervasyon, Ödeme, Teslim, Hasar ve arıza, Hesap, Kurumsal; yalnızca sorusu olanlar), Yardım merkeziyle aynı veri. Bireysel / Kurumsal ayrımı kiralama kutusunda seçili olan sekmeden gelir: Kurumsal seçiliyse kurumsal sorular, değilse bireysel sorular görünür.
- **Satır görünümü (v0.7, G: Framer "FAQs"):** satırlar tek bir yumuşak kapsayıcıda ayrı kartlar olarak üst üste durur; **aynı anda tek cevap açıktır** (v0.6'daki "bağımsız açılır" kaldırıldı); artı simgesi iki ince çizgidir, açılınca dikey çizgi yatıya döner ve eksiye dönüşür; cevap yaylı açılır (sertlik 500, sönüm 60). Her konunun ilk sorusu açık başlar. Arama kutusu ve soru numarası yok (§5.6: sırası olmayan içeriğe numara verilmez).
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
- Ekrandaki toplam gösterim içindir; tahsil edilen tutarı backend hesaplar (ADR-15). Fiyatlar **KDV dahil** gösterilir ve özetin altında "KDV dahil" yazar. Farklı bayiye bırakmanın **ek ücreti yoktur** (G, 10 Ekim).
- **Araç tutma (G, 10 Ekim):** **Kirala**'ya basınca seçilen araç 15 dakika tutulur. Özet ve ödeme sayfasında kalan süre görünür (ekran okuyucuya sürekli okunmaz; son bir dakikada ve süre dolunca bildirilir). Süre dolarsa araç serbest kalır, ziyaretçiye "Süre doldu" durumu ve aynı aramaya dönüş düğmesi gösterilir. Ödeme sırasında araç başkasınca alınmışsa (çakışma) "Bu araç az önce kiralandı" durumu gösterilir.

**Kurumsal talep:**
Ana sayfa (Kurumsal) → form → "Talebiniz alındı" → satış ekibi arar. Ürün detayındaki "Teklif Al" → `/kurumsal-teklif`.

**Bayi bulma:**
Bayilerimiz → şehir filtresi ve/veya arama → liste ve haritadaki pinler daralır → bayi kartı (adres, çalışma saatleri, `tel:` telefon, e-posta, yol tarifi linki).

**Kampanya kodu (v0.6, G; v0.7: rezervasyon özetine taşındı):** rezervasyon özetinde "Fiyat özeti" panelinin içinde bir kod kutusu (ödeme sayfasında artık yoktur; orada kod ve indirim salt okunur satırlardır). Kod adreste durur (kişisel veri değil), sunucu fiyatı kodla hesaplar; indirim özette, ödemede ve onayda ayrı bir satırdır ve araç ile ek hizmetlerin toplamından düşer. Tanımsız kod "geçerli değil" der, fiyat değişmez. Deneme kodları kurgusaldır (NOVERA10 %10, HOSGELDIN %5).

**Uygun Araçlar'da filtre (v0.7, G):** "N araç bulundu" başlığının sağında bir **Filtrele** düğmesi (etkin filtre sayısı rozetle) bir panel açar: sınıf (aramada bulunan sınıflar), vites, yakıt, en az koltuk ve sıralama (en ucuz, en pahalı, en yeni). Seçim hemen uygulanır ve adreste durur (`sinif`, `vites`, `yakit`, `koltuk`, `sirala`), arama parametreleriyle birlikte paylaşılabilir; aynı çip yeniden basılınca grubu temizler; "Filtreleri temizle" hepsini sıfırlar. Filtreye uyan araç yoksa kendi boş durumu ve temizleme bağlantısı gösterilir. Süzme sunucuda yapılır.

**Puanla öde (v0.7, G; v1'deki "puanla ödeme yok" kararı değişti):** yalnızca **giriş yapmış bireysel hesapta ve TL'de**. Sonuç çubuğunda (sayım satırının sağında, Filtrele ve görünüm düğmesinin yanında) bir anahtar ("Puanla öde · 165 puan = ₺825 · 1 puan = ₺5"); açıkken her kart "165 puan + ₺1.575" gibi puan ve kalan parayı gösterir ve "Kirala" seçimi (`puan=1`) rezervasyon özetine taşır. **1 puan = ₺5 (v0.8, G; v0.7'deki ₺1 değişti); puan, kampanya kodundan sonra kalan tutarın en çok yarısını karşılar** (bir kiralama bedava olmaz). Oturum yoksa anahtar yerine "Puanla ödemek için giriş yapın" bağlantısı görünür; TL dışında hiç gösterilmez. Özet sayfasında aynı anahtar bulunur. Backend sözleşmesinde yoktur: `POST /reservations/price` gövdesine `usePoints` önerilir (BE'ye iletilecek); mock'ta fiyatı sunucu hesaplar.

**Sonuç kartları (v0.8, G):** fiyat sırası **önce toplam** ("3 gün toplam ₺2.400", büyük), altında günlük fiyat ("₺800 / gün"), altında "KDV dahil". Kartta **100 km'de yakıt tüketimi** ("5,2 L/100 km", elektrikte "15,5 kWh/100 km") ilk bilgidir. Kartta yaş ya da ehliyet yılı yazmaz (kural §2.10). Sonuç çubuğunda bir **görünüm düğmesi**: **liste** (varsayılan; her araç ana sayfadaki filo kartları gibi yatay geniş bir satır: foto, ad ve bilgi çipleri, sağda fiyat ve Kirala) ya da **ızgara** (üç kart yan yana). Seçim adreste durur (`gorunum=izgara`; liste iz bırakmaz) ve filtre ile puan parametrelerini korur; mobilde tek sütundur.

**Fiyat özeti satırları (v0.7, G):** araç, ek hizmetler, (bir şey düşülüyorsa) **ara toplam**, **kampanya indirimi**, **puan** (−₺165, 165 puan), **toplam** ve altında **toplamın içindeki KDV** ("Toplamın KDV'si (%20) dahildir: ₺332,50"). KDV (%20, kurgusal oran) fiyatın içindedir, üstüne eklenmez: toplamın altıda biridir. Aynı satırlar özette, ödeme sayfasındaki kısa özette ve onayda görünür.

### 2.4 Araçlarımız (ana sayfa bölümü)

- **v0.5 (G):** ayrı Araçlarımız sayfası kalktı; filo, ana sayfada kiralama kutusunun hemen altında bir bölümdür ve yalnızca **Bireysel** sekmede görünür (Kurumsal sekmede araç seçilmez). Bölümün adresi `/#araclarimiz`.
- Filodaki modeller kategoriye göre; sınıflar ve modeller ucuzdan pahalıya.
- **Kategoriler (v0.5):** bölümün üstünde kategori çipleri ("Ekonomik", "Orta sınıf"…); **"Tümü" yoktur, ilk kategori seçili başlar ve yalnızca seçili kategorinin modelleri görünür.** Çipte model sayısı yazar.
- **Kart yatay (v0.4):** fotoğraf solda, bilgiler sağda; mobilde de yatay, sıkıştırılmış. Stok fotoğraf, marka-model, sınıf, hap bilgiler (yakıt tüketimi: L/100 km, elektrikli araçta kWh/100 km; yakıt tipi; vites; koltuk; bagaj) ve günlük fiyat. **Kartlar tek sütundur, her satırda bir kart (v0.6, G).** Fiyat ayrı bir bloktur: üstte küçük "Başlayan fiyat", ortada büyük tutar, yanında küçük "/ gün"; blok kartın sağında, dar ekranda altında durur. Kartın içinde sağda bir ok işareti; hover'da kart ve ok tepki verir. Kartın tamamı tek bir tıklama hedefidir.
- **Pencere:** karta tıklanınca yeni sayfa açılmaz, pencere (modal) açılır. İçerik: daha detaylı bilgi (tüm özellikler, kısa açıklama) ve modelin bulunduğu bayiler (bayi adı, şehir; Bayilerimiz sayfasına bağlantı).
- Pencere adreste iz bırakır: `/?arac=<model>`; adresteki diğer parametreler (ör. `?tip=`) korunur. Link paylaşılınca aynı pencere açık gelir; geri tuşu ve Esc kapatır; kapanınca odak tıklanan karta döner. Kanonik adres `/`'dir (ARCHITECTURE ADR-22).
- Bölüm kendi yükleniyor, boş ve hata durumlarını taşır; yüklenmesi ana sayfanın geri kalanını geciktirmez.

### 2.5 Ürünler ve hizmetler

- **v0.7 (G): ürün sayfaları yenilendi.** Liste: dört kart, her biri kendi tonunda yumuşak bir zeminde (zeytin, taş, ege mavisi, yaprak) ve köşesinde sitenin renkleriyle çizilmiş küçük bir çizimle (filo panosu, VIP araç, takvim, yaprak); öne çıkan ürün tam genişlikte ilk sırada, diğer üçü altında; üzerine gelince kart yükselir, çizim büyür ve döner. Altta "Hangisi size uygun?" çağrısı. Detay: ürünün tonunda bir hero (rozet, başlık, konsept, "kimler için", Teklif Al), "Ne alıyorsunuz?" için üç ikonlu kart, numaralı "Teknolojik artısı" paneli, xl'de yapışkan teklif kartı ve "Diğer çözümler".
- Ürün detayı üç bölümdür: **Konsept**, **Ne Alıyorsunuz?**, **Teknolojik Artısı** (v0.2'deki "Neler dahil" ve "Kimler için" yerine). Ürün kartında başlık, Konsept metni ve "En çok tercih edilen" rozeti (yalnızca Akıllı Kurumsal Filo Kiralama).
- Hizmetlerde her hizmetin başlığı, Ek A'daki tek cümlelik açıklaması ve 3 kısa maddesi bulunur. Maddeleri Claude yazar (G onayladı), Ek A'daki iddiaların dışına çıkmaz.
- Ürün adresleri yeni slug'larla değişir (Ek A). Site yayında olmadığı için eski adreslere yönlendirme gerekmez.

### 2.6 İletişim

Yukarıdan aşağıya:

1. Başlık ve kısa giriş.
2. **Genel merkez:** fotoğraf (yer tutucu), adres, `tel:` telefon, `mailto:` e-posta, yol tarifi linki.
3. **Departman e-postaları:** Pazarlama, Satış, İş Birlikleri; her biri ayrı `mailto:` bağlantısı.
4. **İletişim formu:** ad soyad, e-posta, telefon (isteğe bağlı), konu, mesaj, KVKK onay kutusu; gönderince "Mesajınız alındı" durumu (§9).
5. **Yardım merkezi kartı (v0.8, G):** formun altında "Yardım merkezi" kartı (kısa metin ve `/yardim` düğmesi); önceki "Size en yakın bayi" kartının yerini aldı. Bayilerimiz'e bağlantı kartın içinde küçük bir cümle olarak kalır (bayi listesi ve harita Bayilerimiz sayfasındadır, §2.6.1).

**E-posta bağlantıları (v0.7, G: Framer "Smart Contact Link"):** sitedeki e-posta adresleri (genel merkez, departmanlar, bayi kartı, kurumsal hesap) düz `mailto:` yerine bir düğmedir; basılınca üstünde bir balon açılır: "E-posta gönder" (`mailto:`) ve "Adresi kopyala" (panoya kopyalar, "Kopyalandı" der). Balon yaylı açılır, ekran kenarından taşmaz; dışarı tıklayınca, Esc'ye basınca (odak düğmeye döner) ya da Tab ile çıkınca kapanır. Adres "@" içeriyorsa e-posta, değilse telefon kabul edilir (telefonlara henüz uygulanmadı).

Genel merkez ve departman bilgileri kurgusaldır ve sabit içeriktir (çeviri dosyası); e-postalar gerçek bir kişiye gitmeyen ayrılmış bir alan adıyla yazılır (`.example`). Bayi verisi API'den gelir.

#### 2.6.1 Bayilerimiz (`/bayilerimiz`, v0.5)

- Yalnızca başlık (giriş cümlesi yok, v0.6, G); şehir ve bayi arama alanları başlığın altında ortalanır. Masaüstünde (1280 px ve üstü) bayiler haritanın solunda alt alta listelenir. Listenin üstünde şehir filtresi ve metin arama (bayi adı, ilçe, adres). **Şehir filtresi arama kutulu bir açılır listedir (v0.6, G; referans Framer "SearchableDropdown"):** her şehir bayi sayısıyla görünür, yazdıkça daralır (büyük/küçük harf, Türkçe harf ve aksan fark etmez), ok tuşları, Home, End ve Enter ile gezilir, Esc kapatır. Filtre ve arama hem listeyi hem haritadaki pinleri daraltır. 1280 px altında Liste / Harita geçişi. Harita yüklenemezse liste görünür.
- Her bayi arama motoruna `AutoRental` olarak bildirilir (JSON-LD, §9); bu bildirim İletişim'den bu sayfaya taşındı. Yükleniyor, boş ve hata durumları vardır.
- **Kartlar (v0.6, G):** her kartta bayinin **şu an açık mı** olduğu yazar ("7/24 açık", "Şu an açık · kapanış 20:00", "Kapalı · açılış yarın 09:00"; Türkiye saatine göre, tarayıcıda hesaplanır) ve bir **Buradan kirala** düğmesi vardır: ana sayfadaki kiralama kutusunu o bayi alış ve iade bayisi seçili olarak açar (`/?alis=<bayi>`). Adreste olmayan bir bayi yok sayılır.
- **Bayi türü çipleri (v0.6):** Tümü / Havalimanı / Şehir merkezi, sayılarıyla; şehir ve metin aramasıyla birlikte süzer. Tür şimdilik bayi adından okunur ("…Havalimanı"); API bayiye tür alanı verince oradan gelir.
- **Bana en yakın bayiler (v0.6):** düğmeye basılınca tarayıcı konum izni ister, kartlar yakından uzağa dizilir ve her kartta "yaklaşık X km" yazar; sıralama kaldırılabilir. Konum yalnızca sayfada tutulur, kaydedilmez. İzin verilmezse ya da alınamazsa liste olduğu gibi kalır ve bu söylenir.
- Başlık, şehir ve metin arama alanları ortalanır.
- Navbarda "Bayilerimiz" olarak yer alır (§2.8).

### 2.7 Hakkımızda

- **Hikayemiz:** referans Framer "Oxbow". Dalgalı bir çizgi üzerinde yıllar; seçilen kilometre taşının kartı (görsel, yıl, başlık, metin) açılır. Oklar, klavye (sol/sağ ok) ve dokunmatikte kaydırmayla gezilir; otomatik oynatma yok. 768 px altında dikey liste. Mevcut 6 kilometre taşı kullanılır, her biri bir görselle (yer tutucu).
- **Rakamlar:** referans Framer "StatsSection". Ortalanmış büyük sayılar ve etiketleri; bölüm görününce sayılar bir kez, yaklaşık 2 saniyede yavaşlayarak artar. `prefers-reduced-motion`'da doğrudan son değer görünür; ekran okuyucu yalnızca son değeri okur. Değerler §4.1'deki tablodan.
- Sayfanın geri kalanı (açılış, misyon/vizyon, sürdürülebilirlik, CTA) tasarım olarak değişmez; G sonra modernleştirecek. Yalnızca metinlerdeki rakamlar §4.1'e göre düzeltilir.

### 2.8 Navigasyon ve footer

```
Masaüstü: (yüzen hap) [Logo]  Araç Kirala · Bayilerimiz · Ürünler ▾ · Hizmetler · Hakkımızda   [İletişim]  ‖  ₺ TRY ▾ · 🇹🇷 TR ▾ · [hesap simgesi]
Mobil:    (hap) [Logo]                                                     [hesap simgesi] [☰]
```

- **Görünüm (v0.5, G):** navbar sayfanın üstünde yüzen, tam yuvarlak bir **hap**tır (referans Framer "Modern Navbar"): beyaz zemin (koyu temada yüzey rengi), ince çizgi, hafif gölge; solda logo, linkler bir arada, sağda tercihler ve hesap. Link üzerine gelince yuvarlak, hafif dolgulu bir hap belirir. Navbar sayfayla kayar, yapışmaz (odaktaki öğeyi örtmesin, WCAG 2.2). Mobilde aynı hap daha küçük köşeyle durur.
- Linkler: Araç Kirala · Bayilerimiz · Ürünler · Hizmetler · Hakkımızda. **İletişim, diğer linklerden farklı görünür** (çerçeveli hap) ve **belirgin bir boşlukla ayrı durur**; hesap simgesinden de ayırt edilebilir. Mobil menüde de aynı vurgu.
- **Hesap (v0.5, G):** giriş yapılmamışsa zeminden ayrışan dolgulu **Giriş Yap** butonu (v0.4, G); giriş yapmışsa yazı yok, yuvarlak bir **kullanıcı simgesi** (`aria-label` "Hesabım") profile gider.
- **Link hover'ı (v0.7, G: Framer "SplitTextHover"):** üzerine gelince ya da odaklanınca harfler sırayla (0,3 sn, harf başına 20 ms) yukarı yuvarlanır, altından aynı harfler gelir; ekran okuyucu kelimeyi bir kez okur. Mobil menüde (hover yok) eski dolgu kalır. Aynı efekt "Yol Boyu Güvence'yi inceleyin" bağlantısındadır.
- **Ürünler menüsü (v0.7, G: Framer "Pill Dropdown Nav"):** tıklamanın yanında imleç başlığın üstünde durunca da açılır (120 ms içeri, 200 ms dışarı gecikme; dokunmatikte yalnızca tıklama), ok döner, panel 10 px altta yaylı açılır ve imlecin ya da odağın bulunduğu satırın arkasında bir vurgu kayar. Hover'la açılınca odak yerinde kalır; klavye ve Esc davranışı değişmedi.
- **Ürünler (v0.5, G):** yalnızca Ürünler açılır menüdür; açılınca 4 ürün listelenir, her biri kendi sayfasına gider. Masaüstünde başlık menüyü açan bir düğmedir; liste sayfası menünün son maddesidir ("Tüm ürünler →"), çünkü hem link hem açılır menü olan bir öğe tıklanınca ne olacağını belirsizleştirir. Klavyeyle açılıp gezilebilir, Esc kapatır; mobil menüde başlık liste sayfasına gider ve öğeler altında girintili listelenir. **Hizmetler (v0.5) açılır değildir**, düz bir linktir; hizmetler kendi sayfasındaki akordeondadır.
- **Para birimi (v0.4, G):** navbarda kendi açılır menüsü; düğmede seçili birimin simgesi ve kodu (`₺ TRY`), listede `₺ TRY`, `€ EUR`, `$ USD`. Linklerle aynı yazı ve üzerine gelme diliyle yazılır.
- **Dil (v0.5, G):** kendi açılır menüsü; düğmede bayrak ve kod (`TR`), listede bayrak ve dilin kendi adı (Türkçe, English). Bayraklar satır içi SVG'dir (emoji bayrak bazı sistemlerde harf olarak çizilir), dekoratiftir; İngilizce için İngiliz bayrağı. Mobilde para birimi ve dil hamburger menünün içindedir. Footer'da tercih yok.
- **Tema (v0.5, G):** navbarda artık tema seçimi yoktur. Giriş yapan kullanıcı temayı yalnızca Profil > Ayarlar'dan seçer (§2.9); ziyaretçi her zaman açık temayı görür.
- **Giriş Yap** girişe gider; giriş sayfasında Bireysel ve Kurumsal sekmeleri vardır (§2.9).
- Navbar'da ayrı "Kurumsal Teklif" linki yok (G'nin kararı); kurumsal giriş noktası ana sayfadaki seçim ve ürün sayfaları.
- Hamburger = site gezintisi. Altı bağlantı 1280px altında yan yana sığmadığı için hamburger mobilde ve tablette görünür, satır içi menü 1280px ve üstünde. Profil menüsü = hesap (her ekranda).
- Giriş yapılmamışsa Profil yerine "Giriş Yap".
- **Footer (v0.7, G):** ↗ oku kalktı; linklerde Framer "Wavy Nav link" efekti: üzerine gelince harfler sırayla 6 px aşağıdan yaylı yerine oturur ve altta ince bir çizgi soldan sağa uzar (hareket azalt açıksa yalnızca çizgi). **İletişim sütunu kalktı** (bilgiler İletişim sayfasında); yerine "Bizi takip edin" sütunu: dört yuvarlak sosyal ikon (Framer "Quick Social Links"), üzerine gelince ya da odaklanınca tabanından 1,25 kat büyür ve üstünde "Instagram · yakında" etiketi yükselir; **bağlantı değildir** (hesap yok), klavyeyle odaklanır. Logonun ve sloganın yanında imleci izleyen bir **göz çifti** (Framer "eyes", süs; 72×108 px gözler, göz kırpar; hareket azalt açıksa düz bakar). Keşfet linkleri iki sütun (Rehberler ve Yardım dahil); alt şeritte yalnızca telif notu; sütun boşlukları tutarlıdır.
- **Footer (v0.6, G: Framer "Simple Footer" tam anlamıyla; ok efekti v0.7'de wavy ile değişti):** link üzerine gelince ya da odaklanınca yanında küçük bir ↗ oku belirir (saydamlıktan görünüre, küçükten normale; 0,6 sn, yumuşak bitişli eğri; okun yeri ayrılmıştır, metin kaymaz). Marka bloğu (xl'de %43) ve alt şerit biraz küçükten yerine oturur, link sütunları aşağıdan yükselir; sayfa o bloğa kaydırılınca bir kez olur, hareket azalt açıksa ya da blok zaten ekrandaysa hiç olmaz. Hareket yalnızca yer ve ölçektir, solma yoktur (opaklığı 0 olan blok kontrast denetiminde hata sayılır). xl altında linkler markadan önce gelir. Sosyal ikonlar bağlantı olmadığı için hover almaz.
- **Footer (düzen):** referans Framer "Simple Footer", açık zeminde (`stone-100`; sayfadaki tek koyu bant Yol Boyu Güvence kalır, §5.4): solda logo, kısa tanım ve altında telif + "kurgusal proje" notu; sağda sade sütunlar: Keşfet linkleri, Yasal linkler (5 sayfa ve "Çerez tercihleri"), iletişim. **Bizi takip edin** (v0.4, G): sosyal medya ikonları görünür ama şimdilik tıklanamaz (bağlantı değil; kurgusal şirketin hesabı yok, adres uydurulmaz). Ekran okuyucu için "yakında" bilgisi taşır.
- Dil (TR/EN) ve para birimi (TRY/EUR/USD) seçimi navbardadır; tema (açık/koyu/sistem; **varsayılan açık**) Profil > Ayarlar'dadır. Giriş yapan kullanıcıda üçü de hesaba kaydedilir. Tutarlar günlük kurla çevrilir (ARCHITECTURE ADR-15); ödeme sahte olduğu için hangi para birimi seçilirse seçilsin para alınmaz.

### 2.9 Hesap, puan, yardım ve rehberler (v0.4)

G'nin 10 Ekim istekleri. Her biri BACKLOG M7'de sırası gelince yapılır.

- **Bireysel ve kurumsal giriş:** giriş sayfasında iki sekme (`/giris`, `?tip=kurumsal`). Kurumsal sekme firma e-postasıyla giriş yapar. Kurumsal hesap basittir: firma bilgisi, teklif talepleri ve iletişim kişisi; filo yönetim paneli kapsam dışı (§3). Kayıt bireyseldir; kurumsal hesap satış görüşmesinden sonra Novera tarafından açılır (öneri; backend ile netleşecek). Backend'de hesap türü gerekir.
- **Ayarlar:** giriş yapan kullanıcı varsayılan para birimini, dili ve temayı seçer; seçim hesaba kaydedilir ve her girişte uygulanır.
- **Puan sistemi:** gösterim ve kurallar. Tamamlanan her rezervasyon, toplam tutarın her tam ₺100'ü için 1 puan kazandırır (ek hizmetler dahil, aşağı yuvarlanır; ₺2.850 = 28 puan; G onayladı, 10 Ekim). İptal edilen rezervasyon puan kazandırmaz. Profilde bakiye (**"165 puan = ₺825 değerinde"**), bekleyen puan, kazanım geçmişi, "Puanla öde" düğmesi ve kurallar (kazanma: her ₺100 = 1 puan; harcama: 1 puan = ₺5, toplamın en çok yarısı) görünür. Kazanılan değerin %5'i harcamada geri döner; G bilerek böyle seçti. **Puanla ödeme (v0.7, G; değer v0.8'de ₺5):** puan, sonuç listesinde "Puanla öde" ile harcanır: 1 puan = ₺5, en çok kalan tutarın yarısı, yalnızca TL ve bireysel hesap (§2.3). Hesabı backend yapar.
- **Profil yenilendi (v0.8, G):** başlıkta baş harf rozeti, "Hoş geldin, Elif", e-posta, puan çipi ("165 puan · ₺825", Puanlarım'a bağlantı) ve çıkış; xl'de solda ikonlu dikey menü ve altında "Yeni kiralama" düğmesi, daha dar ekranda ikonlu yatay sekmeler. **Hesabım** üstte "Sıradaki seyahatiniz" kartı (araç, tarih, alış bayisi ve saati, "N gün kaldı"; seyahat yoksa "İlk kiralamanızı yapın"), hızlı işlemler (Yeni kiralama, Yardım merkezi) ve ad/soyad formudur. Her sayfanın yükleniyor iskeleti sayfa düzenindedir. Kurumsal hesapta aynı kabuk, sekmeler Firma bilgileri, Teklif taleplerim, Ayarlar.
- **Rezervasyonlarım (v0.8):** durum çipleri (Tümü / Yaklaşan / Geçmiş / İptal edilen; adreste `durum=`). Her rezervasyon bir kart: araç (görsel yer tutucu), durum (Yaklaşan, Devam ediyor, Tamamlandı, İptal edildi; renge ek olarak yazılı), numara, alış ve iade bayisi adı ve **saati** (İstanbul saati), süre, toplam, kazanılan ya da bekleyen puan. Yaklaşan ve süren kiralamada **Yol tarifi** (bayi konumu), **Bayiyi ara** (e-posta gibi gönder/kopyala balonu) ve yaklaşanda **İptal et**: onay penceresi "Vazgeç" ile açılır, alışa 24 saatten fazla varsa iptalin ücretsiz olduğunu, azsa olmadığını söyler, iptal edilenin puan kazandırmadığını yazar. **İptal simüledir** (API'de çağrı yok); tarayıcıda bir çerezle tutulur, puan bakiyesine yansır.
- **Ayarlar (v0.8):** Varsayılan tercihler, **Bildirimler** (seyahat öncesi hatırlatma e-postası, varsayılan açık; kampanya e-postaları, varsayılan kapalı, çünkü pazarlama postası için onay gerekir), **Güvenlik** (şifre değiştir: mevcut, yeni en az 8 karakter ve eskisinden farklı, tekrar; açık oturumlar listesi ve "Diğer oturumları kapat"), Hesabı sil. Bildirim, şifre ve oturum çağrıları API'de yoktur; USE_MOCKS=1'de simüle edilir, yoksa "hizmet kullanılamıyor" denir.
- **Rezervasyonlarım (eski satır):** yaklaşan ve geçmiş seyahatler ayrı listelenir; her seyahatte tarih, bayi, araç, tutar ve kazanılan puan.
- **Yardım (`/yardim`):** İletişim'den ayrı. Konulara göre gruplanmış sorular (rezervasyon, ödeme, araç teslimi, hasar ve arıza, hesap), arama, rehberlere bağlantılar; cevap bulunamazsa İletişim'e yönlendirme. SSS içeriğiyle aynı kaynaktan beslenir, ana sayfadaki SSS'nin geniş hâlidir.
- **Araç kiralama rehberleri (`/rehberler`):** 4–6 kısa rehber (ör. gerekli belgeler, yakıt ve teslim kuralları, farklı bayiye iade, hasar durumunda ne yapılır, elektrikli araç kullanımı). Metinleri Claude yazar, iddia uydurmaz. Ana sayfada rehberlerin hepsi yan yana oklarla (sol ve sağ kenarda) kaydırılır; "Tüm rehberler" düğmesi yoktur (v0.6, G), `/rehberler` footer'dan, Yardım'dan ve rehber sayfalarından açılır.
- **Mobil uygulama reklamı:** ana sayfada kendi bölümü (Yol Boyu Güvence'den sonra). Uygulama kurgusal: mağaza düğmeleri ortalanır ve Apple ve Google Play işaretini taşır (v0.6), ama gerçek mağaza bağlantısı yoktur; görsel yer tutucu (fotoğraf kararı §10).

### 2.10 Sürücü uygunluğu (v0.5, G onayladı, 11 Ekim)

Kiralayan kişinin aracı koşullara göre kullanıp kullanamayacağının kontrolü. Kontrol ödemeden önce yapılır. **Sitede gerçek bilgi kullanılmaz:** ehliyet numarası, tarihler ve doğrulama hizmeti kurguseldir, ekranda "deneme" olduğu yazar (ödemedeki deneme kartı gibi).

- **Kural (v0.8, G'nin 15 Ekim kararı):** **18 yaşından büyük ve geçerli bir ehliyeti olan herkes** her aracı kiralayabilir; araç sınıfına göre yaş ya da ehliyet yılı şartı **yoktur**. v0.5'teki sınıf ve ülke tabloları (21/23/25 yaş, 2/3/5 yıl, ülkeye göre ek yıl) benim uydurduğum örnek değerlerdi ve kaldırıldı. Yaş, kiralamanın ilk gününde sayılır (18. yaş günü dahil). Ülkeye bağlı tek şart: ABD ehliyetinde **uluslararası sürücü belgesi** (beyan). Ehliyet tarihi gelecekte olamaz (form denetler), geçerliliği simüle doğrulama söyler. Kurallar `lib/driver-rules.ts`'tedir.

- **Kullanıcıdan istenenler:** doğum tarihi, ehliyetin verildiği ülke, ehliyet numarası, ehliyet veriliş tarihi ve bir beyan onayı ("bilgilerin doğru olduğunu beyan ederim; belgelerim alışta kontrol edilecek"). ABD seçilince uluslararası sürücü belgesi beyanı da istenir.
- **Simüle doğrulama:** "Ehliyetimi doğrula" sahte bir doğrulama servisini çağırır; sonuç geçerli, bulunamadı ya da süresi dolmuş olur (deneme numaralarıyla; ekranda ipucu yazar). Gerçek servis yoktur, gerçek ehliyet numarası girilmez. Yaş ve ehliyet yılı kuralı doğrulamadan ayrıca ve kiralamanın **başlangıç gününe** göre uygulanır.
- **Saklanmaz (G):** doğum tarihi, ehliyet numarası ve tarihleri ne hesaba, ne rezervasyon kaydına, ne tarayıcıya (depolama, çerez) ne de adrese yazılır; yalnızca rezervasyon anında kontrol için kullanılır. Bu, KVKK Aydınlatma Metni'nde yazar.
- **Akıştaki yeri:** `/odeme`, kart formunun üstünde "Sürücü bilgileri". Uygun değilse ödeme düğmesi kapalı kalır, tutmayan kural (yaş) açıkça yazılır. Kontrol sunucu eyleminde yeniden yapılır (istemci atlanabilir). 15 dakikalık tutma sürmeye devam eder.
- **Karar öncesi şeffaflık (v0.8):** sonuç kartında koşul yazmaz; rezervasyon özetinde tek cümle: "18 yaşından büyük ve geçerli ehliyeti olan herkes kiralayabilir" ve Kiralama Koşulları bağlantısı. Kiralama Koşulları metni de buna göre yazıldı.
- **Kapsam dışı (ilk sürüm):** "Ek sürücü" seçilince ikinci sürücünün kontrolü; sürücü bilgisinin profilde saklanması.

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
- Kurumsal filo yönetim paneli ("Filom": araç, sürücü, fatura takibi). Basit kurumsal hesap (giriş, firma bilgisi, taleplerim) v0.4'te kapsama girdi (§2.9)
- Puanla ödeme backend'de (puanlar v0.7'den beri ön yüzde harcanabilir; kesin hesap ve düşüm API işidir)

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
- **Gölge:** neredeyse yok. Derinlik gölgeyle değil zemin tonu farkıyla (paper → beyaz kart) verilir; sadece açılan menülerde, pencerelerde, arama alanında ve yüzen navbar hapında (v0.5) hafif gölge.
- **Kırılma noktaları:** 375 (tasarım buradan başlar) · 768 · 1280.

### 5.4 Yerleşim konsepti: "sade, ama düz değil"

- Sadelik az öğeden gelir: her bölümün tek bir görevi ve tek bir birincil butonu var.
- "Düz değil" hissi ritimden gelir, süsten değil:
  - Bölümler her zaman ortalanmış değil; metin solda / görsel sağda, sonraki bölümde tam genişlik, sonra koyu bant. Göz her bölümde aynı kalıba alışmaz.
  - Sayfa akışında bir kez **koyu zeytin bant** (`olive-900`) kullanılır: Yol Boyu Güvence bölümü. Açık sayfada tek koyu bölüm, dikkati oraya toplar.
  - Büyük, kenarları yuvarlatılmış fotoğraflar; araç fotoğraflarında doğal ışık ve açık hava.
- **Hareket:** varsayılan olarak yalnızca durum değişikliğini anlatan geçişler (anahtar değişince alanın yumuşak geçişi, pencere açılıp kapanması). Kaydırınca beliren dekoratif animasyon yok.
  - **İstisnalar (v0.3, G'nin onayı):** iş birlikleri şeridi (v0.7: kendiliğinden akar, üzerine gelince/odaklanınca durur), Yol Boyu Güvence adımları (görününce bir kez sırayla dolar, sonra durur; v0.7, G: Framer "StepProgress"; v0.6'daki akan iz kalktı), nav ve footer linklerinde harf hover'ı, ürün kartlarının hover'ı, Smart Contact Link balonu, sosyal ikonların büyümesi, göz çiftinin imleci izlemesi, Hakkımızda sayaçları ve **Sürdürülebilirlik rakamları** (görününce bir kez sayar; v0.7: yüzdeler 0'dan tam puanlarla sayar), Hikayemiz zaman çizelgesi (seçim değişince geçiş), SSS'nin yaylı açılması, galeri slayt geçişi.
  - Kendiliğinden başlayan bir geçiş yok: galeri ve zaman çizelgesini kullanıcı ilerletir.
  - `prefers-reduced-motion` açıksa hareketli her şey durur ya da anında geçer.

### 5.5 Akılda kalacak tek öğe: Yol Boyu Güvence

Hakkımızda metnindeki "Sadece Araç Kiralamıyoruz, Yol Boyu Güvence Sunuyoruz" cümlesi markanın güven vaadi. Bu vaat sitede **somut bir bileşene** dönüşür:

- **Ana sayfada:** iş birliklerinden sonra, koyu yeşil bantta, bir aksilik anının senaryosu olarak anlatılır: *Yolda kaldın → tek dokunuşla SOS → GPS ile en yakın çekici yönlendirilir → 7/24 operasyon masası seni arar → arıza 24 saati aşarsa yedek araç kapında.* İkon kartları değil, soldan sağa (mobilde yukarıdan aşağı) ilerleyen tek bir zaman çizgisi.
- **Karar anlarında tekrar:** rezervasyon özetinde ve ödeme ekranında aynı güvencenin kısa bir şerit hâli ("Bu kiralama Yol Boyu Güvence kapsamında: 7/24 destek, çekici, yedek araç"). Kullanıcı tam para öderken güven mesajını görür.
- **Şeffaf fiyat:** rezervasyon özetinde tüm kalemler açık yazılır, "gizli ücret yok" ibaresi. Güven sadece söylenmez, fiyat ekranında gösterilir.

### 5.6 Kaçınılacaklar

Eşit üç sütunlu ikon+başlık+gri metin kartları, gerekçesiz gradient (**tek istisna, v0.7, G:** ürün kartları ve ürün sayfasının hero'su, temanın kendi tonlarından yumuşak bir zeminle; her ürünün kendi tonu vardır), sırası olmayan içeriğe 01/02/03, her bölümde aynı ortalanmış yerleşim, amaçsız animasyon, saf siyah metin, saf gri nötrler.

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
6. Ana sayfada filo bölümünde bir kategori seçilir, yalnızca o kategorinin modelleri görünür; bir karta tıklanır, pencere açılır, modelin bayileri görünür; Esc ile kapanır, odak karta döner.
7. Bayilerimiz'de şehir filtresinden "İzmir" seçilir; liste ve pinler daralır. İletişim'de form gönderilir.
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
| Fotoğraf kaynağı (stok / üretilmiş / yer tutucu) | G | Galeri, araçlar, Hikayemiz, genel merkez |
| Analytics aracı: Vercel Web Analytics veya Umami | G | Yayın ortamına bağlı (ADR-12, ADR-19); ücretsiz plan koşulları doğrulanmadı |
| Kampanya içeriği sabit mi, API'den mi | İKİ | Şimdilik sabit |
| Kurumsal hesap nasıl açılır | İKİ | Öneri: satış görüşmesinden sonra Novera açar, sitede kurumsal kayıt yok |
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
