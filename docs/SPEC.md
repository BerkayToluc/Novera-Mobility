# Novera Mobility: Ürün Tanımı (SPEC)

> Durum: **v2.0** · 22 Ekim 2026 · Sahip: G (Product/Project Manager). Geliştirme: Berkay (full stack, Claude Code ile).
> v1'in sayfa sayfa ayrıntılı tanımı (v0.2–v0.11) [archive/v1/SPEC.md](archive/v1/SPEC.md) içindedir; canlıdaki ekranların davranışı için oraya bakılır. Bu belge v2'nin kapsamını tanımlar.
> Tasarım kuralları [DESIGN.md](DESIGN.md), mimari [ARCHITECTURE.md](ARCHITECTURE.md), işler [BACKLOG.md](BACKLOG.md), sıra [ROADMAP.md](ROADMAP.md).
> Bu belgeyle bir istek çelişirse geliştirici durur ve G'ye sorar. Değişiklik PR ile yapılır; sürüm notu en alttadır.

---

## 1. Amaç, kitle, roller

- **Ürün:** kurgusal kurumsal araç kiralama şirketi Novera Mobility'nin web sitesi. Bireysel kullanıcı çevrimiçi araç kiralar; kurumsal firma teklif ister ve v2'den itibaren filosunu **Filom** panelinden yönetir; Novera çalışanı siteyi **Yönetim panelinden** yönetir.
- **Kitle:** (1) kısa dönem araç arayan bireysel kullanıcı ve KOBİ, (2) uzun dönem filo kiralayan kurumsal filo yöneticisi, (3) Novera çalışanı (yönetici).
- **v2'nin amacı:** önce v1'in temelini sağlamlaştırmak (güvenlik, veri bütünlüğü, kod düzeni, kalite), sonra ürün sayfalarında satılan ama sitede yalnızca metin olan özellikleri çalışır hâle getirmek.
- **Başarı ölçütü (v2):** §6'daki kabul akışlarının hepsi canlıda 375 ve 1280 px'te ve yalnızca klavyeyle geçer; [QUALITY.md](QUALITY.md)'deki Kritik ve Yüksek bulguların hepsi kapalıdır.
- **Ekip ve roller:**

| Kişi | Rol | Ne yapar |
|---|---|---|
| G | Product / Project Manager | Kapsamı ve sırayı belirler, issue açar, PR'ı kabul kriterine göre Vercel önizlemesinde kontrol eder, birleştirir |
| Berkay | Full stack geliştirici | Tüm kodu (API, web, veritabanı, CI) Claude Code ile yazar; PR açar |

Çalışma süreci: [WORKFLOW.md](WORKFLOW.md).

---

## 2. Bugünkü ürün (v1, canlıda)

Canlı ortam: web Vercel, API Google Cloud Run, veritabanı Neon ([DEPLOY.md](DEPLOY.md)).

### 2.1 Sayfa hiyerarşisi

TR yollar öneksiz, EN yollar `/en` altında ve çevrilmiştir (`apps/web/i18n/routing.ts`).

| Grup | Sayfalar (TR) | Menüden erişim | Dizine girer mi |
|---|---|---|---|
| Tanıtım | `/` (Araç Kirala: galeri, kiralama kutusu, filo, iş birlikleri, Yol Boyu Güvence, uygulama bölümü, rehberler, SSS), `/bayilerimiz`, `/urunler`, `/urunler/:slug` (4 ürün), `/hizmetler`, `/hakkimizda`, `/iletisim`, `/yardim`, `/rehberler`, `/rehberler/:slug` | Navbar: Ana sayfa, Bayilerimiz, Ürünler (açılır), Hizmetler, Hakkımızda, İletişim. Footer ek olarak Rehberler, Yardım | Evet |
| Kurumsal dönüşüm | `/kurumsal-teklif` | **Menüde yok**, yalnızca sayfa içi düğmelerden (v2'de düzelir, §3.A) | Evet |
| Kiralama akışı | `/araclar` → `/rezervasyon` → `/odeme` → `/rezervasyon/onay` | Arama formundan | Hayır |
| Hesap | `/giris` (Bireysel/Kurumsal sekmeleri, Google ile giriş), `/kayit`, `/sifre-sifirla`, `/sifre-sifirla/yeni`, `/profil` (+ `rezervasyonlar`, `puanlar`, `teklifler`, `ayarlar`) | Navbar hesap simgesi | Hayır |
| Yasal | `/kvkk`, `/gizlilik-politikasi`, `/cerez-politikasi`, `/kullanim-sartlari`, `/kiralama-kosullari` | Footer | Evet |
| Sistem | 404 (markalı), 500, `robots.txt`, `sitemap.xml`, `llms.txt`, manifest | — | — |

v2 ile eklenecek bölümler: `/yonetim/...` (EN `/en/admin/...`) ve `/filom/...` (EN `/en/my-fleet/...`). İkisi de `noindex`, sitemap ve `llms.txt` dışında; navbar ve footer'da bağlantıları yoktur, hesap menüsünden açılırlar.

### 2.2 Çalışan akışlar

- **Bireysel kiralama:** bayi ve tarih seç → uygun araçlar (filtre, liste/ızgara, "Puanla öde") → **Kirala** aracı 15 dakika tutar → özet (ek hizmet, kampanya kodu, puan, KDV dahil toplam, geri sayım) → giriş → sürücü bilgileri ve sahte ödeme → onay. Fiyatı API hesaplar.
- **Hesap:** kayıt, giriş, Google ile giriş (yalnızca bireysel), şifre sıfırlama (Resend e-postası), ayarlar (dil, tema, para birimi hesapta), oturumlar, Rezervasyonlarım (yaklaşan/geçmiş, iptal), Puanlarım (her ₺100 = 1 puan, 1 puan = ₺5, toplamın en çok yarısı).
- **Kurumsal:** teklif formu (ürün seçili gelebilir, teslim şehirleri 81 ilden), kurumsal sekmeden giriş, firma bilgisi ve Teklif taleplerim. Kurumsal hesabı bugün açmanın bir yolu yok (v2'de Yönetim panelinden, §3.B).
- **İletişim ve yardım:** iletişim formu, SSS (Bireysel/Kurumsal, konulara göre), Yardım merkezi araması, bayi listesi ve harita.
- **Gizlilik:** çerez onayı (kabul, ret, ayarlar eşit ağırlıkta), analytics yalnızca onayla ve yalnızca yapılandırılmışsa.

### 2.3 Rakamlar (tek kaynak)

Sitede, örnek veride ve seed'de aynı rakamlar kullanılır: kuruluş 2012, 14 şehirde 15 bayi (İstanbul'da 2), 15 araç modeli (her model 1–4 bayide), 4.200 kurumsal müşteri, filonun %18'i elektrikli/hibrit. v2'de yönetici bayi ve model ekleyip kapatabildiği için bu rakamlar **seed'in başlangıç durumudur**; Hakkımızda sayaçları ve metinler sabit kalır (kurgusal şirket tanıtımı).

### 2.4 İçerik kuralları

- Türkçe ana dil, İngilizce tam karşılık. Tüm arayüz metni `messages/tr|en/<özellik>.json` dosyalarındadır; panel metinleri de (`admin.json`, `fleet-panel.json`).
- Ton kurumsal ama mesafeli değil; buton metinleri fiille başlar ("Bayi ekle", "Talebi gönder").
- Tutarlar API'den `{ amount, currency }` alt birim tam sayısıyla gelir, `lib/price.ts` biçimlendirir; ekranda yuvarlanmaz.
- Ürün ve hizmet metinleri (Ek A) **çeviri dosyalarında kalır**, panelden düzenlenmez (G, 22 Ekim). Pazarlama metinleri v2'de değişmez; çalışmayan özellikler (Driver App, SOS, canlı çekici takibi) kurgusal tanıtım olarak durur.
- Kurgusal veri ekranda öyle yazar: faturalar "örnek fatura, yasal belge değildir", karbon tasarrufu "örnek hesap", konum ve şarj istasyonu verisi "Simülasyon".

---

## 3. v2 kapsamı

Beş parça; sıra [ROADMAP.md](ROADMAP.md)'dedir ve **A bitmeden B–E başlamaz**.

### 3.A Temel sağlamlaştırma

v1 hızlı büyüdü; 22 Ekim keşfi bir kritik, beş yüksek ve birçok orta bulgu çıkardı (ayrıntı ve dosya:satır [QUALITY.md](QUALITY.md)). v2'de yeni özellik yazılmadan önce:

1. **Acil güvenlik (Faz 1):**
   - geçmiş tarihli rezervasyonla anında puan kazanma kapanır;
   - rezervasyon oluşturmaya hız sınırı ve kişi başı aktif rezervasyon tavanı gelir;
   - API, gizli anahtar ve doğru ortam ayarı olmadan açılmaz (fail-closed);
   - kampanya kodları tahmin edilemez, tavanlıdır ve seed canlıda onlara dokunmaz;
   - web'de örnek veri modu (`USE_MOCKS`) üretime sızamaz;
   - kullanılmayan `/api` yönlendirmesi kalkar.
2. **Temel (Faz 2):**
   - Girdi doğrulama API'de ve web'de tek yöntemle yapılır (zod).
   - Hız sınırı kalıcı bir depoda tutulur ve tüm uçları kapsar.
   - Oturum ve parola güvenliği güçlenir: parola özeti, boşta kalma süresi, hesap silmede doğrulama.
   - Veritabanı bütünlüğü sağlanır: FK, CHECK, indeks, `updatedAt`, migration kayması.
   - KVKK saklama süresi tanımlanır.
   - Kod tekrarları temizlenir.
   - Sayfalar yalnızca gereken çeviri metnini yükler.
   - Bilgi mimarisi düzeltilir: Kurumsal teklif menüye girer.
   - API'deki kullanılmayan içerik kopyası silinir.
   - CI'a bağımlılık taraması ve gerçek API'ye karşı uçtan uca test eklenir.
   - UI/UX ve erişilebilirlik turu ile production Lighthouse ölçümü yapılır.
   - Son güvenlik turu yapılır.

Kabul: QUALITY.md'deki her bulgu kapalı ya da gerekçesiyle "kabul edildi" olarak işaretli; SECURITY.md v2 güncel.

### 3.B Yönetim paneli

Novera çalışanının siteyi koddan bağımsız yönettiği iç ekranlar (`/yonetim`). Tasarım ve kurallar: [ADMIN.md](ADMIN.md).

- **Kim:** yalnızca `ADMIN` rolündeki hesap. Yönetici hesabı komut satırından açılır, Google ile giriş yapamaz, oturumu 12 saattir. Yetkisiz kullanıcı paneli 404 olarak görür.
- **Modüller (G, 22 Ekim):**

| Modül | Ne yapılır |
|---|---|
| Özet | Bugün başlayan/biten kiralamalar, son 7 gün, bekleyen teklif, mesaj ve talep sayıları |
| Kampanya kodları | Ekle, düzenle, pasifleştir; yüzde, geçerlilik aralığı, toplam kullanım tavanı, kişi başı tek kullanım; kullanılmış kod silinmez |
| Bayiler | **Ekle, düzenle, kapat ve yeniden aç** (ad, şehir, adres, konum, telefon, e-posta, çalışma saatleri, tür). Gelecek rezervasyonu ya da aktif aracı olan bayi kapatılamaz; kapanan bayi aramada, Bayilerimiz'de ve haritada görünmez |
| Araç modelleri | **Ekle, düzenle, kaldır** (marka, model, sınıf, yakıt, vites, koltuk, bagaj, tüketim, günlük fiyat, açıklama TR/EN, **fotoğraf panelden yüklenir**). Kaldırılan model pasifleşir; gelecek rezervasyonu varsa kaldırılamaz |
| Araçlar | Fiziksel araç **ekle ve kaldır** (model, plaka, yıl, bayi), bayisini değiştir. Kaldırılan araç pasifleşir; gelecek rezervasyonu varsa kaldırılamaz |
| Ek hizmetler | Ad ve fiyat düzenleme |
| Rezervasyonlar | Ara, süz, detay, iptal (nedenli; puan kuralları kullanıcı iptaliyle aynı) |
| Teklif talepleri | Durum akışı (Alındı → İnceleniyor → Teklif verildi → Kapandı), iç not |
| İletişim mesajları | Liste, "ele alındı" |
| Kurumsal müşteriler | Şirket aç, kurumsal kullanıcı davet et (kurumsal hesap açmanın tek yolu), Filom verisi: sözleşmeler, filo araçları, okumalar, faturalar, masraflar |
| Talepler | Filom'dan gelen servis ve VIP transfer taleplerinin durumunu yönetme (§3.D) |
| Kullanıcılar | Ara, detay, hesabı kapat / yeniden aç |
| İşlem kaydı | Kim, ne zaman, neyi değiştirdi (salt okunur; değer değil alan adı) |

- **Yok:** ürün, hizmet ve SSS metinlerinin düzenlenmesi (içerik modülü), kampanya galerisi ve iş ortağı logoları, ikinci rol, iki adımlı doğrulama.

### 3.C Filom: kurumsal filo paneli ("Tek ekranda yönetim")

Akıllı Kurumsal Filo Kiralama ürününde "Tek ekranda yönetim" ve "Novera Admin Paneli Dahil" diye, Yeşil Filo'da "batarya sağlığı ve karbon raporu" diye satılan panelin çalışan hâli. Ekrandaki adı **Filom** (`/filom`); pazarlama adı ürün sayfalarında kalır. Tasarım: [FLEET.md](FLEET.md).

- **Kim:** filo sözleşmesi olan şirketin kurumsal kullanıcıları (bir şirkette birden çok kullanıcı, hepsi filo yöneticisi). Sözleşmesi olmayan kurumsal hesap boş durum ve teklif çağrısı görür; bireysel hesap giremez. Bir şirket başka şirketin hiçbir kaydını göremez.
- **Ekranlar:** Özet, Araçlar, Canlı takip (§3.E), Personel, Zimmet, Sözleşmeler (yenileme talebi), Faturalar, Masraflar (HGS, trafik cezası, bakım; o anda zimmetli personele otomatik eşlenir, personele yansıtılır ya da itiraz edilir), Talepler (§3.D), Raporlar (araç, departman, ay bazında maliyet ve kilometre) ve Yeşil Filo (karbon tasarrufu, batarya sağlığı, şarj durumu ve yakın istasyonlar, §3.E).
- **Veri:** sözleşme, filo aracı, okuma, fatura ve masrafları Novera Yönetim panelinden girer (ya da seed); müşteri personeli, zimmeti, masrafın personele yansıtılmasını ve talepleri yönetir. Tutarlar TL'dir.
- **KVKK:** personel kişisel veridir, ehliyet bilgisi saklanmaz; KVKK metnine "kurumsal müşteri personeli" bölümü eklenir.

### 3.D Servis ve transfer talepleri

Hizmetler sayfasındaki üç hizmet ve VIP Mobilite'deki şoför koordinasyonu, Filom'dan açılan **talepler** olarak çalışır; Novera Yönetim panelinde karşılar.

| Talep türü | Kaynağı (Ek A) | Filom'da girilen | Durum akışı |
|---|---|---|---|
| Yol yardım / çekici | Akıllı Yol Yardım & Çekici | Filo aracı, konum (adres ya da "konumumu kullan"), olay türü (arıza, kaza, lastik, yakıt/şarj), açıklama | Alındı → Yönlendirildi → Yolda → Tamamlandı (ya da İptal) |
| İkame araç | Kesintisiz İkame Araç | Filo aracı, teslim adresi, tarih, tahmini süre | Alındı → Onaylandı → Teslim edildi → İade alındı (ya da İptal) |
| Bakım ve lastik | Periyodik Bakım & Lastik Oteli | Filo aracı, işlem (periyodik bakım, yaz/kış lastiği, muayene), tercih edilen tarih, vale ile alınsın mı, adres | Alındı → Randevu verildi → Serviste → Tamamlandı (ya da İptal) |
| VIP transfer | VIP Mobilite: şoför koordinasyonu, uçuş takibi | Yolcu adı, uçuş numarası, karşılama yeri (havalimanı/adres), tarih-saat, varış adresi, yolcu sayısı, not. **Yalnızca VIP Mobilite sözleşmesi olan şirkette** | Alındı → Şoför atandı → Karşılandı → Tamamlandı (ya da İptal) |

- Her durum değişikliği talebin zaman çizelgesine yazılır; Filom'da müşteri görür, durum değişince talebi açan kişiye e-posta gider (BACKLOG V2-44).
- Yönetici talebe atanan çekici/servis/şoför bilgisini serbest metinle girer (gerçek tedarikçi entegrasyonu yok). Uçuş takibi gerçek bir uçuş servisine bağlanmaz; uçuş numarası bilgi olarak saklanır.
- 7/24 Operasyon Masası ve SOS ayrı özellik olmaz: Filom'da her talep ekranında operasyon masası telefonu ve "acil durumda 112" notu gösterilir.

### 3.E Canlı takip ve Yeşil Filo şarj (simülasyon)

- **Canlı takip:** Filom'da filo araçları haritada; her araçta son konum, kontak açık/kapalı, hız, son güncelleme zamanı ve son 24 saatin rotası. Veri gerçek cihazdan gelmez; sunucuda her araç için **tekrarlanabilir biçimde üretilir** (aynı araç ve saat için hep aynı sonuç) ve ekranın her yerinde "Simülasyon" rozeti vardır. Sayfa 30 saniyede bir yenilenir. Harita yüklenmezse aynı bilgi listede görünür.
- **Yeşil Filo şarj durumu:** elektrikli ve hibrit filo araçlarında şarj seviyesi (son okuma), batarya sağlığı eğilimi ve araca en yakın şarj istasyonları (ad, uzaklık, soket türü, müsait/dolu/arızalı). İstasyonlar kurgusal seed verisidir, durumları simülasyondur.
- Harita: v1'de kullanılan Google Maps (ARCHITECTURE ADR-09); açık karar §7.

---

## 4. Kapsam dışı (v2)

- **Mobil uygulama** (iOS/Android; G, 22 Ekim: şimdilik yok). Sonradan yapılırsa API'de gereken değişiklikler ARCHITECTURE "Sonraya: mobil" bölümündedir.
- Novera Driver App, dijital hasar tutanağı, uygulama içi SOS (tanıtım metni olarak kalır).
- Gerçek telematik ve GPS cihazı, gerçek uçuş takibi, gerçek çekici/servis tedarikçisi entegrasyonu.
- Gerçek ödeme ve gerçek e-fatura (ödeme ekranı ve Filom faturaları kurgusal).
- Ürün/hizmet/SSS içeriğinin panelden düzenlenmesi, kampanya galerisi yönetimi.
- Yönetici için iki adımlı doğrulama, ikinci yönetici rolü, Filom'da şirket içi roller.
- Kurumsal müşterinin siteden kendi başına araç kiralaması ya da sözleşme imzalaması; çoklu araç sepeti.
- Kariyer, basın sayfaları.

---

## 5. Kalite gereksinimleri

v1'in kalite gereksinimleri (SEO, sitemap, `noindex`, alt metinler, çerez onayı, analytics, net CTA, formlar, kırık link kontrolü, 404/500, favicon, `llms.txt`, güvenlik başlıkları; [archive/v1/SPEC.md](archive/v1/SPEC.md) §9) aynen geçerlidir. v2'de eklenen ya da sıkılaşan:

| Gereksinim | Kabul ölçütü |
|---|---|
| Güvenlik temeli | OWASP ASVS 4.0 Seviye 1'in uygulanabilir maddeleri karşılanır (kontrol listesi QUALITY.md §3.1). Her uç doğrulanmış girdi alır, hız sınırı altındadır, yetkisi test edilir |
| Yetki testleri | Her `/admin/*` ucu için "oturumsuz 401, müşteri 403"; her `/fleet/*` ucu için "başka şirketin kaydı 404, bireysel hesap 403" testi zorunludur |
| Veri bütünlüğü | İş kuralları veritabanı kısıtıyla da korunur (CHECK, FK, benzersiz indeks); migration'lar şemayla birebir (CI'da kayma kontrolü) |
| Responsive | 320, 375, 768, 1024, 1280 px'te yatay sayfa kaydırması yok; panelde geniş tablo kendi kutusunda kayar |
| Erişilebilirlik | WCAG 2.2 AA; axe uçtan uca testlerde çalışır ve ihlalde kırmızıdır; ekran okuyucu turu (NVDA) kiralama, teklif, panel ve Filom akışlarında yapılır |
| Durumlar | Veri gösteren her ekranda yükleniyor, boş ve hata durumu |
| Hız | Core Web Vitals (mobil, production build): LCP < 2,5 sn, INP < 200 ms, CLS < 0,1 |
| Test | Yeni her uç için birim + HTTP testi; yeni her ekran için en az bir e2e; CI'da gerçek API'ye karşı smoke testi |
| İşlem kaydı | Panelde ve Filom'da değiştiren her işlem kayda geçer (alan adları, değer değil) |

---

## 6. Kabul akışları

v2 "bitti" sayılmadan önce canlıda, önce 375 px mobil tarayıcıda, sonra 1280 px'te ve yalnızca klavyeyle:

1. v1 akışları ([archive/v1/SPEC.md](archive/v1/SPEC.md) §8): bireysel kiralama uçtan uca, Rezervasyonlarım, kurumsal teklif, filo bölümü penceresi, Bayilerimiz filtresi, iletişim formu, çerez reddi.
2. Geçmiş tarihli rezervasyon denemesi reddedilir; aynı kampanya kodu ikinci kez kullanılamaz.
3. Yönetici giriş yapar; yeni bir bayi ekler, sitede Bayilerimiz'de ve aramada görür; bayiyi kapatır, ikisinden de kalkar.
4. Yönetici fotoğraflı yeni bir araç modeli ve o modele bir araç ekler; ana sayfa filo bölümünde ve aramada görünür; aracı kaldırır.
5. Yönetici bir kampanya kodu açar; kullanıcı özet sayfasında kullanır; tavan dolunca kod reddedilir.
6. Yönetici bir rezervasyonu iptal eder; kullanıcının Rezervasyonlarım ve puanları doğru güncellenir; işlem kaydında görünür.
7. Yönetici şirket açar ve kullanıcı davet eder; davetli e-postadaki bağlantıyla şifre belirler, kurumsal sekmeden girer, Filom'u açar.
8. Filom'da araç bir personele zimmetlenir; yöneticinin girdiği HGS masrafı o personele eşlenir; müşteri masrafı personele yansıtır; fatura detayında "örnek fatura" notu görünür; rapor toplamı fatura ve masraflarla tutar.
9. Filom'dan yol yardım talebi açılır; yönetici durumu "Yolda" yapar; müşteri zaman çizelgesinde görür ve e-posta alır. VIP sözleşmesi olmayan şirkette transfer talebi seçeneği yoktur.
10. Canlı takip haritasında araçlar ve "Simülasyon" rozeti görünür; harita kapalıyken liste aynı bilgiyi verir. Yeşil Filo'da elektrikli araç için yakın istasyonlar listelenir.
11. Bireysel hesap `/filom` ve `/yonetim`'e giremez (giriş ya da 404); A şirketinin kullanıcısı B şirketinin aracını adresle açamaz (404).

---

## 7. Açık kararlar

| Karar | Kimde | Öneri | Gerektiği an |
|---|---|---|---|
| Fotoğraf depolama servisi | G | Vercel Blob (ücretsiz katman koşulları uygulama günü doğrulanır); alternatif Cloudinary | V2-28 başlamadan |
| ~~Kişi başı aktif (gelecek) rezervasyon tavanı~~ | G | **Karar (24 Ekim 2026): 3** | V2-03 |
| KVKK saklama süresi (iletişim mesajı, teklif talebi) | G | 2 yıl, sonra anonimleştirme | V2-12 |
| Canlı takip ve şarj haritası | G | Google Maps (anahtar ve CSP hazır, ADR-09); anahtar yoksa yalnız liste | V2-40, V2-43 |
| Analytics aracı (v1'den kalan) | G | Umami Cloud ücretsiz ya da Vercel Web Analytics | V2-45 |
| E-posta gönderen alan adı | G + Berkay | Alan adı yoksa Resend test adresi (yalnızca kendi adrese gider; demo için yeterli) | V2-33, V2-44 |

---

## Ek A. Ürün ve hizmet içeriği ve v2 karşılığı

İçerik G'nin 9 Ekim 2026 mesajındandır; tam metin [archive/v1/SPEC.md](archive/v1/SPEC.md) Ek A ve `messages/*/products.json`, `services.json` içinde. Aşağıdaki tablo hangi vaadin v2'de çalışır hâle geldiğini gösterir.

| Ürün / hizmet | Vaat | v2'de |
|---|---|---|
| Akıllı Kurumsal Filo Kiralama | Tek ekranda yönetim, Novera Admin Paneli (zimmet, sözleşme, fatura, HGS) | **Filom** (§3.C) |
| | Masraf ve ceza takibi | Filom > Masraflar (§3.C) |
| | Canlı takip, GPS ve telematik | Filom > Canlı takip, **simülasyon** (§3.E) |
| VIP Mobilite | Öncelikli konsiyerj, şoför koordinasyonu, uçuş takibi | **VIP transfer talebi** (§3.D); konsiyerj hattı talep ekranında telefon olarak |
| Esnek & Kısa Dönem | Esnek süreli kiralama | v1 kiralama akışı (çalışıyor) |
| | Novera Driver App, dijital hasar tutanağı, SOS | Kapsam dışı (§4), tanıtım metni kalır |
| Yeşil Filo | Batarya sağlığı, karbon raporu | Filom > Yeşil Filo (§3.C) |
| | Şarj istasyonu durumu | Filom > Yeşil Filo, **simülasyon** (§3.E) |
| Akıllı Yol Yardım & Çekici | En yakın çekiciyi yönlendirme | **Yol yardım talebi** (§3.D); canlı çekici takibi yok |
| 7/24 Canlı Operasyon Masası | Anında bağlantı | Talep ekranlarında operasyon masası telefonu |
| Kesintisiz İkame Araç | Eşdeğer yedek araç kapıda | **İkame araç talebi** (§3.D) |
| Periyodik Bakım & Lastik Oteli | Lastik değişimi, muayene takibi, vale | **Bakım ve lastik talebi** (§3.D); muayene ve bakım tarihleri Filom > Araçlar'da |
| Novera SOS & Acil Durum | Tek dokunuşla acil müdahale | Kapsam dışı (§4) |

---

## Sürüm notları

- **v2.0 (22 Ekim 2026, G):** belge sıfırdan yazıldı. Roller değişti (G PM, Berkay full stack). Kapsam: temel sağlamlaştırma, Yönetim paneli (bayi/model/araç ekleme dahil, fotoğraf yükleme), Filom, servis ve transfer talepleri, canlı takip ve şarj simülasyonu. İçerik modülü ve mobil uygulama kapsam dışı. Berkay'ın 20 Ekim önerisi (v0.11, ADMIN/FLEET/ROADMAP) temel alındı ve arşivlendi.
