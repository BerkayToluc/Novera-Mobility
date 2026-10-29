# Yönetim paneli (ADMIN)

> Durum: **v2.0** · 22 Ekim 2026. Kapsam SPEC §3.B, mimari ARCHITECTURE ADR-24, ADR-27, ADR-28; işler BACKLOG Faz 3–6 ve Faz 10.
> Berkay'ın 20 Ekim taslağı ([archive/v1/ADMIN.md](archive/v1/ADMIN.md)) temel alındı. Farklar: bayi ve model **eklenebilir**, model fotoğrafı yüklenir; ürün/hizmet/SSS metinleri panelden düzenlenmez; talepler modülü eklendi.
> Uçların kesin biçimi her işin PR'ında `docs/api/openapi.yaml`'a yazılır; çelişki olursa sözleşme kazanır.

## 1. Ne bu

Novera çalışanının siteyi koddan bağımsız yönettiği iç ekranlar: katalog (kampanya kodları, bayiler, araç modelleri, araçlar, ek hizmetler), operasyon (rezervasyonlar, teklifler, mesajlar, talepler), kurumsal müşteriler ve Filom verisi, kullanıcılar, işlem kaydı.

İki panel vardır ve ekranda adları karışmaz:

| Ad | Kim | Adres | Belge |
|---|---|---|---|
| **Yönetim paneli** | Novera çalışanı (`ADMIN`) | `/yonetim` · `/en/admin` | Bu belge |
| **Filom** | Kurumsal müşterinin filo yöneticisi | `/filom` · `/en/my-fleet` | [FLEET.md](FLEET.md) |

"Novera Admin Paneli" yalnızca ürün sayfalarındaki pazarlama adıdır ve Filom'u anlatır.

## 2. Kim girer

- **Rol:** `User.role` alanının değerleri `CUSTOMER` (varsayılan) ve `ADMIN`. Hesap türünden (`accountType`) ayrıdır.
- **Yönetici hesabı siteden açılmaz.** Kayıt, Google ile giriş ya da panelin kendisi rol veremez. Berkay komut satırından açar:
  ```powershell
  cd apps\api
  $env:DATABASE_URL = '<Neon adresi>'
  pnpm admin:create --email yonetici@novera.example --name "Ad Soyad"
  Remove-Item Env:DATABASE_URL
  ```
  Komut parolayı ekrandan ister (sohbete, dosyaya ya da geçmişe yazılmaz), en az 12 karakter şartı vardır. `--revoke` rolü geri alır ve açık oturumları kapatır.
- **Giriş:** normal `/giris` sayfası, e-posta + parola. Yönetici hesabında Google ile giriş kapalıdır (`403 GOOGLE_NOT_ALLOWED`).
- **Oturum:** 12 saat (müşteride 30 gün), boşta kalma süresi 1 saat.
- **Yetkisiz:**
  - Web: `/yonetim/*` sayfaları sunucuda rol bakar. Giriş yoksa `/giris?sonra=yonetim`, rol yoksa **404**.
  - API: `/admin/*` oturum yoksa `401`, rol yoksa `403 FORBIDDEN`.

## 3. Ekranlar

Tüm sayfalar `noindex`, sitemap ve `llms.txt` dışında; navbar ve footer'da bağlantı yok. Yönetici giriş yapınca hesap menüsünde tek bir "Yönetim paneli" bağlantısı görünür. Yerleşim kuralları [DESIGN.md](DESIGN.md) §8.

| Ekran | Adres (TR) | Ne yapılır | İş |
|---|---|---|---|
| Özet | `/yonetim` | Bugün başlayan ve biten kiralamalar, son 7 günün rezervasyon sayısı, yanıt bekleyen teklif, mesaj ve talep sayısı; her kart süzgeçli listeye gider | V2-25 |
| Kampanya kodları | `/yonetim/kampanya-kodlari` | Liste (kod, yüzde, geçerlilik, kullanım / tavan, durum), yeni, düzenle, pasifleştir | V2-26 |
| Bayiler | `/yonetim/bayiler`, `.../yeni`, `.../:id` | Liste (şehir süzgeci, açık/kapalı), **yeni bayi**, düzenle, **kapat / yeniden aç** | V2-27 |
| Araç modelleri | `/yonetim/modeller`, `.../yeni`, `.../:slug` | Liste (sınıf, yakıt, fiyat, araç sayısı, durum), **yeni model (fotoğraf yükleme)**, düzenle, **kaldır** (pasifleştir) / geri al | V2-29 |
| Araçlar | `/yonetim/araclar` | Liste (plaka, model, bayi, yıl, durum; süzgeç), **yeni araç**, bayisini değiştir, **kaldır** (pasifleştir) / geri al | V2-30 |
| Ek hizmetler | `/yonetim/ek-hizmetler` | Ad (TR/EN) ve fiyat düzenleme | V2-30 |
| Rezervasyonlar | `/yonetim/rezervasyonlar`, `.../:numara` | Ara (numara, e-posta), süz (durum, alış bayisi, tarih), detay (fiyat dökümü, kod, puan), iptal | V2-31 |
| Teklif talepleri | `/yonetim/teklifler`, `.../:numara` | Liste, durum değiştir, iç not | V2-32 |
| Mesajlar | `/yonetim/mesajlar`, `.../:id` | İletişim formu mesajları, "ele alındı" | V2-32 |
| Şirketler | `/yonetim/sirketler`, `.../:id` | Şirket bilgisi, kullanıcı davet et, sözleşmeler | V2-33 |
| Sözleşme | `/yonetim/sirketler/:id/sozlesmeler/:numara` | Filo araçları (ekle, iade), bakım ve muayene tarihleri, okuma girişi | V2-35 |
| Faturalar | `/yonetim/faturalar` | Dönem seç → "Faturaları oluştur", liste, ödendi işareti | V2-37 |
| Filo masrafları | `/yonetim/filo-masraflari` | HGS, ceza, bakım kaydı girişi (plakayla), liste | V2-38 |
| Talepler | `/yonetim/talepler`, `.../:numara` | Servis ve transfer talepleri; tür ve durum süzgeci, atanan kişi, durum ilerletme, not | V2-41, V2-42 |
| Kullanıcılar | `/yonetim/kullanicilar`, `.../:id` | Ara, detay (rezervasyonlar, puan, şirket), hesabı kapat / yeniden aç | V2-34 |
| İşlem kaydı | `/yonetim/kayit` | Kim, ne zaman, neyi değiştirdi; süzgeç: yönetici, alan, tarih (salt okunur) | V2-34 |

### 3.1 Katalog kuralları

**Kampanya kodları**
- **Biçim:** kod büyük harf, 3–20 karakter (`normalizePromoCode`); yüzde 1–90.
- **Alanlar:** geçerlilik aralığı (`validFrom`, `validUntil`, ikisi de isteğe bağlı), toplam kullanım tavanı (`maxRedemptions`, boşsa sınırsız), kişi başı tek kullanım (`oncePerUser`, varsayılan açık).
- Bir rezervasyonda kullanılmış kod silinmez, pasifleştirilir (`IN_USE`). Kullanım sayısı iptal edilmemiş rezervasyonlardan hesaplanır.
- Kod kullanımı rezervasyon anında satır kilidiyle sayılır; tavan aşılırsa `422 CODE_EXHAUSTED`.

**Bayiler**
- **Alanlar:** ad, şehir (81 il listesinden), adres, enlem/boylam (haritadan seç ya da elle gir), telefon, e-posta, tür (`CITY`, `AIRPORT`), çalışma saatleri (hafta içi, cumartesi, pazar; her biri açılış-kapanış ya da kapalı).
  - Bugün tür addan çıkarılıyor (`apps/web/lib/branch-detail.ts:19-22`); v2'de alan olur.
- **Yeni bayi:** hemen sitede görünür (Bayilerimiz, arama seçici, harita, JSON-LD, sitemap). İçinde araç olmadığı için aramada "uygun araç yok" boş durumu çıkar.
- **Kapatma (`closedAt`):** bayide gelecekte başlayan ya da biten rezervasyon, etkin tutma ya da etkin araç varsa `409 IN_USE` döner; ekran nedenini listeler ("3 gelecek rezervasyon, 4 araç"). Önce araçlar başka bayiye taşınır ya da kaldırılır.
  - Kapanan bayi aramada, Bayilerimiz'de, haritada ve sitemap'te görünmez; geçmiş rezervasyonlarda adıyla kalır.
  - Bayi silinmez, yeniden açılabilir.

**Araç modelleri**
- **Alanlar:** marka, model, slug (oluşturulurken addan önerilir, **sonra değişmez**: `?arac=` bağlantıları bozulmasın), sınıf, yakıt, vites, koltuk, bagaj, tüketim ve birimi, günlük fiyat (TRY), açıklama (TR/EN), fotoğraf.
- **Fotoğraf** (ADR-28): JPEG/PNG/WebP, **seçilen dosya en çok 5 MB**, en az 1200 px genişlik. Yükleme önizlemeli; alt metin model adından üretilir.
  - **Sunucuya giden en çok 4 MB'tır:** Vercel işlevleri 4,5 MB'tan büyük istek gövdesini reddeder ve telefon fotoğrafı sık sık 3–8 MB'tır. Tarayıcı fotoğrafı önce 2000 px genişliğe ve WebP'ye küçültür (genelde birkaç yüz KB); sunucu aynısını yeniden yapar ve kendi kararını verir. Tarayıcı bunu yapamazsa (eski tarayıcı) dosya olduğu gibi gider; 4 MB'ı aşıyorsa kullanıcı "çok büyük" cevabı alır.
  - **Sunucu** dosyanın türünü ilk baytlarından anlar (adına ya da bildirilen türe bakmaz), yönünü düzeltir, 2000 px'e ve WebP'ye çevirir, EXIF/ICC/XMP'yi atar, 60 milyon pikselden büyük görseli açmaz ve dosyaya rastgele bir ad verir. Yalnızca yönetici yükleyebilir.
  - **Yetim dosya:** yükleme yapılıp form kaydedilmezse dosya depoda kalır (v2'de temizlenmez, kabul edildi).
- **Fiyat değişikliği** yeni aramalarda geçerlidir; var olan rezervasyonun tutarı değişmez (tutar rezervasyonda donmuştur).
- **Kaldırma (`retiredAt`):** gelecek rezervasyonu ya da etkin tutması olan modelde `409 IN_USE`. Kaldırılan modelin etkin araçları da pasifleşir. Ana sayfa filo bölümünde, aramada ve `?arac=` penceresinde görünmez; geçmiş rezervasyon kartlarında görünür.
- Yeni sınıf eklenmez (sınıflar sabit).

**Araçlar**
- **Alanlar:** model, plaka (Türk plaka biçimi, büyük harf, benzersiz), model yılı (2015 – bu yıl + 1), bayi.
- **Kaldırma** (`active = false`): gelecek rezervasyonu ya da etkin tutması olan araçta `409 IN_USE`. Bayi değişikliği de aynı kurala bağlıdır.
- Kapalı bayiye ya da kaldırılmış modele araç eklenemez (`422`).

**Ek hizmetler:** yalnızca ad ve fiyat düzenlenir; yeni ek hizmet eklenmez (fiyat hesabı türlerine bağlı).

### 3.2 Operasyon kuralları

- **Rezervasyon iptali:** nedeni zorunludur. Kullanıcı iptaliyle aynı sonucu verir: harcanan puan geri döner, bekleyen puan düşer. Başlamış rezervasyon iptal edilemez (`INVALID_TRANSITION`). Kullanıcıya e-posta gider (V2-44).
- **Teklif durumu:** `RECEIVED → IN_REVIEW → OFFERED → CLOSED`; geri gidiş yoktur. İç not müşteriye görünmez. Filom'dan gelen sözleşme yenileme talebi de buraya düşer.
- **Mesaj:** "ele alındı" işareti (`handledAt`, `handledById`) geri alınabilir.
- **Talepler:** durum akışı türe göredir (SPEC §3.D, ADR-31). Yönetici "atanan" alanına çekici, servis ya da şoför bilgisini serbest metinle yazar; her adım zaman çizelgesine girer.

### 3.3 Hesap kuralları

- **Kurumsal hesap açma** (kurumsal hesap açmanın tek yolu):
  1. Yönetici şirketi açar: ad, vergi dairesi, şehir, telefon, satış temsilcisi.
  2. Şirket sayfasından kullanıcı davet eder: e-posta, ad, soyad, ünvan.
  3. API parolasız bir `CORPORATE` hesap açar, şirkete bağlar ve 7 gün geçerli şifre belirleme bağlantısı gönderir (şifre sıfırlama akışı, ayrı metin).
  - Aynı e-posta varsa `409 EMAIL_TAKEN`. Bireysel hesabı kurumsala çevirmek yoktur.
- **Hesap kapatma (`disabledAt`):** tüm oturumlar kapanır. Giriş ve Google girişi `401 INVALID_CREDENTIALS` ile reddedilir (hesabın durumu sızmaz). Gelecek rezervasyonlar **iptal edilmez**; ekran sayısını gösterir, gerekirse yönetici tek tek iptal eder. Yönetici kendini ve başka bir yöneticiyi kapatamaz.

### 3.4 Ortak davranışlar (V2-24'te bir kez yapılır)

- **Liste:** tablo, 20'şer sayfalama, arama, süzgeç çipleri. Süzgeç ve sayfa adreste durur (`?durum=CONFIRMED&sayfa=2`), paylaşılabilir. Yükleniyor iskeleti, boş ve hata durumu vardır.
- **İki dilli alan:** TR ve EN sekmeli tek bileşen, ikisi de zorunlu.
- **Kaydet:** server action, ADR-26 şemasıyla doğrular, API'ye gider. Alan hataları alanın yanında (`fieldErrors` kodu çeviri dosyasından), başarıda bildirim (`aria-live`). Kaydedilmemiş değişiklikle sayfadan çıkılırsa uyarı.
- **Çakışma:** form `updatedAt` taşır. `409 STALE_WRITE` gelirse "Bu kayıt siz düzenlerken değişti" uyarısı çıkar, girilenler kaybolmaz.
- **Geri alınamayan işlem:** onay penceresi, düğmede işlemin adı, varsayılan odak "Vazgeç".
- **Erişilebilirlik:** `<th scope>`, `aria-sort`, klavyeyle tam kullanım, WCAG 2.2 AA.
- **Metinler:** `messages/tr/admin.json`, `messages/en/admin.json`.

**Bileşenler (V2-24):** yukarıdaki davranışlar `apps/web/components/admin/` altındadır; her ekran bunları kullanır, kendi tablosunu ya da penceresini yazmaz.

| Bileşen | Ne yapar |
|---|---|
| `AdminShell`, `AdminNav` | Çerçeve ve menü (xl'de sol sütun, dar ekranda üstte açılır). Menü `lib/admin-screens.ts`'ten gelir: bir ekran `ready: true` olunca ve adresi `i18n/routing.ts`'e eklenince menüde görünür (testle denetlenir) |
| `PageHeader` | Başlık ve en çok bir birincil düğme |
| `DataTable` | Başlık sırası (`aria-sort`), ilk sütunda satır bağlantısı, yükleniyor/boş/hata, kendi kutusunda yatay kayma |
| `Pagination`, `SearchBox`, `FilterChips` | Sayfa, arama ve süzgeç; hepsi adreste durur |
| `StatusChip` | Metinli durum çipi (yalnız renkle durum anlatılmaz) |
| `BilingualField`, `ListField`, `FileField` | İki dilli alan (hata olan sekme açılır), satır ekle/sil/taşı, dosya alanı (yalnız arayüz; yükleme V2-28) |
| `ConfirmDialog`, `Toast`, `StaleWriteBanner`, `UnsavedChangesGuard` | Onay penceresi (odak "Vazgeç"te), bildirimler (`aria-live`; hata kapatılana dek durur), `409 STALE_WRITE` uyarısı, kaydedilmemiş değişiklik uyarısı |

**Adres ve API sorgusu:** `lib/admin-query.ts` adresi (`sayfa`, `sirala`, `ara`, süzgeçler) okur, izin verilen değerlere göre denetler (uydurma değer hata değil varsayılan olur) ve API sorgusuna (`page`, `pageSize`, `sort`, `q`) çevirir; sayfa boyutu en çok 100.

**Sergi:** `/dev/admin` (EN `/en/dev/admin`) bileşenleri örnek veriyle gösterir. Geliştirme ortamında ve test koşusunda (`NOVERA_E2E=1`) açıktır, gerçek sitede 404'tür (`lib/dev-pages.ts`).

**Bilinen sınırlar:** `UnsavedChangesGuard` tarayıcının Geri düğmesini Next yönlendiricisinde yakalayamaz (sekmeyi kapatma ve site içi bağlantılar yakalanır). Panel düzeni (`layout`) iki panel sayfası arasında geçişte yeniden çizilmez; bu yüzden yetkiyi asıl denetleyen API'dir (her `/admin/*` çağrısında rol).

### 3.5 Özet ekranı (V2-25)

`GET /admin/summary` ve `/yonetim`. Yalnızca okur, işlem kaydına yazılmaz. Sayıların tanımı:

| Kart | Tanım |
|---|---|
| Bugün başlayan / biten kiralama | İptal edilmemiş rezervasyonlardan `startAt` / `endAt` **İstanbul gününde** olanlar. Gün `[00:00, ertesi gün 00:00)`; sunucunun ya da tarayıcının saat dilimi sayıyı değiştirmez. Bir rezervasyon aynı gün başlayıp bitiyorsa ikisinde de sayılır |
| Son 7 günde yapılan rezervasyon | `createdAt` bugün ve önceki altı İstanbul günü içinde, iptal edilmemiş |
| Yanıt bekleyen teklif talebi | Durumu `RECEIVED` olan |
| Ele alınmamış mesaj | İletişim mesajında "ele alındı" işareti V2-32'de gelir; o zamana kadar API `null` döner ve kart çizilmez |
| Açık servis talebi | Talepler V2-41'de gelir; o zamana kadar `null`, kart çizilmez |

Bir kart, bağlı olduğu liste ekranı yapılınca (`lib/admin-screens.ts` `ready`) süzgeçli bağlantıya döner. Süzgeç adları `lib/admin-summary.ts`'te durur (`baslangic=bugun`, `bitis=bugun`, `olusturma=7gun`, `durum=RECEIVED`, `durum=ele-alinmadi`, `durum=acik`); liste ekranlarını yapan işler (V2-31, V2-32, V2-41) bunları adresten okur. Hiçbir kart bir kişinin verisini göstermez, yalnızca sayı. Tüm sayılar sıfırsa ekran "Her şey yolunda" der.

### 3.6 Kampanya kodları ekranı (V2-26)

`/yonetim/kampanya-kodlari` (EN `/en/admin/promo-codes`), `/yeni` ve `/{kod}`; uçlar `GET/POST /admin/promo-codes`, `GET/PATCH/DELETE /admin/promo-codes/{code}`.

- **Durum tek bir kelimedir.** Birden fazlası doğruysa şu sırayla ilki: `INACTIVE` (kapalı), `EXPIRED` (bitişi geçti), `EXHAUSTED` (tavan doldu), `SCHEDULED` (henüz başlamadı), `ACTIVE`. `ACTIVE` yalnızca rezervasyon anında gerçekten uygulanacak kod demektir; liste ile rezervasyon kontrolü aynı tarih kuralını okur (`isPromoUsable`, bitiş anı dahil değil), testle denetlenir.
- **Tarihler gün olarak seçilir** (İstanbul saati): "ilk geçerli gün" günün 00:00'ında başlar, "son geçerli gün" **dahildir**; kod ertesi günün 00:00'ında biter. API kesin anları tutar; başka yoldan girilmiş saatli bir kod, form o tarihe dokunulmadıkça olduğu gibi kalır (yalnızca değişen alan gönderilir).
- **Kod değişmez.** Ad, oluşturulurken seçilir; sonra değiştirilemez. Başka ad için yeni kod açılır.
- **Yüzdeyi değiştirmek** var olan rezervasyonların tutarını etkilemez (tutar rezervasyonda donmuştur).
- **Tavan** şimdiye kadarki kullanımdan az olamaz (`BELOW_USAGE`). Değişiklik ve rezervasyon aynı kod satırını kilitler; aynı anda gelen rezervasyonla sırayla çalışırlar.
- **Silme:** hiçbir rezervasyonda, **iptal edilmiş olsa bile**, kullanılmamış kod silinir. Kullanılmışsa `409 IN_USE` döner ve **hiçbir şey değişmez**; ekran "silinemez, kapatmak ister misiniz?" der ve kodu kapatır (`PATCH active: false`). Kapalı kod yeni rezervasyonlarda uygulanmaz, eskiler değişmez.
- **Çakışma:** düzenleme, kaydın `updatedAt` değerini taşır; arada değiştiyse `409 STALE_WRITE`, hiçbir şey yazılmaz. Ekran girilenleri korur ve "güncel kaydı yükle" önerir.
- **Veritabanı:** kod biçimi (`^[A-Z0-9]{3,20}$`) ve `validUntil > validFrom` CHECK ile de korunur (migration `20261030120000`, `NOT VALID`: var olan satırlara bakmaz, yeni yazımları denetler).
- **İşlem kaydı:** `promo-code.create|update|delete`; kod adı varlık kimliği, yalnızca alan adları yazılır.
- **Liste** küçük, elle yönetilen bir tablo olduğu için sunucuda bellekte süzülür, sıralanır ve sayfalanır (kullanım sayısı rezervasyonlardan gelir). Yüzlerce satırı aşarsa veritabanı sorgusuna taşınır.
- **Ortak liste kuralları** (`apps/api/src/admin/admin-list.ts`): `?page=&pageSize=` (en çok 100), `?sort=alan:asc|desc`, cevap `{ items, total, page, pageSize }`. Yanlış değer API'de `422`; web adresinde varsayılana düşer. Sonraki liste uçları aynı yardımcıyı kullanır.

### 3.7 Bayiler ekranı (V2-27)

`/yonetim/bayiler` (EN `/en/admin/branches`), `/yeni` ve `/{id}`; uçlar `GET/POST /admin/branches`, `GET/PATCH /admin/branches/{id}`, `POST /admin/branches/{id}/close` ve `/reopen`.

- **Alanlar:** ad, şehir (81 il), adres, enlem/boylam, telefon, e-posta, **tür** (`CITY`/`AIRPORT`), çalışma saatleri. Tür eskiden addan çıkarılıyordu (`lib/branch-detail.ts`); artık bayinin kendi alanı. Migration `20261030130000`, var olan bayilerin türünü addan **bir kez** doldurur ("Havalimanı" geçenler `AIRPORT`); bayilerin görünüşü değişmez.
- **Konum:** enlem 35,5–42,5, boylam 25,5–45,0 (Türkiye'yi kapsayan kutu, kıyıyı ve sınırı dışarıda bırakmayacak kadar geniş). Enlem ile boylamın yer değiştirmesi gibi yaygın hatayı yakalar; denizdeki bir noktayı yakalamaz. Ondalık için virgül ya da nokta yazılabilir. **Haritadan seçme yoktur** (Maps anahtarı hazır değil, V2-45); formda "noktayı haritada gör" bağlantısı vardır.
- **Çalışma saatleri:** üç gün (hafta içi, cumartesi, pazar); her gün `HH:MM-HH:MM` (açılış kapanıştan önce) ya da `closed`. Formda her gün "Kapalı" kutusu ve iki saat alanıdır; kapalı gün saatleri devre dışı kalır, açılınca eski değerlerini korur. Örnek veri "24:00"ı "gece yarısına kadar" yazar; form bunu kapanış saati olarak kabul eder, API 23:59'a kadar alır.
- **Kapatma** (`closedAt`, silme yok): şunlardan biri varsa `409 IN_USE` ve `details: { reservations, holds, vehicles }`; hiçbir şey değişmez. Sayılar: bu bayide **başlayacak** (alış) ya da bu bayide **bitecek** (dönüş) iptal edilmemiş rezervasyon (sürmekte olup buraya dönecek kiralama da sayılır), süresi dolmamış tutma, açık araç. Ekran bu nedenleri, kapatma düğmesine basılmadan önce bayi sayfasında sayılarıyla listeler; API'nin cevabı belirleyicidir. Kapalı bayi düzeltilebilir ve `reopen` ile olduğu gibi geri gelir. İki çağrı da tekrarlanabilir (idempotent).
- **Kapalı bayi sitede yoktur:** herkese açık `GET /branches`, arama, tutma, fiyat ve rezervasyon onu görmez (`UNKNOWN_REFERENCE`). Geçmiş rezervasyon cevapları bayi adını taşımaya devam eder (satır silinmez). Bayilerimiz sayfası, arama seçici, harita ve JSON-LD aynı `GET /branches` verisinden beslenir; sitemap'te bayi yoktur.
- **Yarış:** rezervasyon ve tutma, bayi satırlarını **paylaşımlı** kilitler (`FOR SHARE`, kilitlerin sonuncusu); kapatma aynı satırı `FOR UPDATE` ile alır. Biri önce gelir: ya rezervasyon yapılır ve kapatma onu görüp reddeder, ya kapatma önce olur ve rezervasyon kapalı bayiyi görüp reddedilir. Kapatma başka kilit almadığı için iki istek birbirini bekleyemez.
- **Düzenleme** `updatedAt` sürümünü taşır (`STALE_WRITE`); yalnızca değişen alan gönderilir, üç çalışma günü birlikte gider.
- **İşlem kaydı:** `branch.create|update|close|reopen`, bayi kimliği varlık, yalnızca alan adları (adres ve telefon yazılmaz).
- **Web önbelleği:** bayi verisi bugün **hiç önbelleğe alınmıyor** (`apiRequest` her çağrıda `no-store`), bu yüzden panelde yapılan değişiklik sitede anında görünür; ADR-24'teki `branches` etiketi ve `revalidateTag` henüz gerekmiyor. Kayıttan sonra yalnızca `revalidatePath("/", "layout")` çağrılır (Next'in tuttuğu işlenmiş sayfaları bırakır). Katalog önbelleğe alınırken (performans işi) kayıt eylemi `revalidateTag('branches')` çağıracaktır.
- **Örnek veri (USE_MOCKS=1):** `mocks/branches.ts` tek depodur; Bayilerimiz, arama seçici ve panel aynısını okur. Depo **dünya** başına tutulur (`novera-mock-world` çerezi, `lib/mock-world.ts`): bayi değiştiren e2e testleri kendi dünyasında çalışır, bayi sayan testler değişmemiş varsayılan dünyayı görür.

## 4. API

Tüm uçlar `/admin` önekli, `AdminGuard` arkasında, ADR-24 kurallarıyla (sayfalama, `STALE_WRITE`, yeni hata kodları). Değiştiren her istek işlem kaydına yazılır, `Content-Type: application/json` dışındakiler `415` döner, sınır dakikada 120/yönetici.

| Alan | Uçlar |
|---|---|
| Özet | `GET /admin/summary` |
| Kampanya kodları | `GET/POST /admin/promo-codes`, `GET/PATCH /admin/promo-codes/{code}`, `DELETE /admin/promo-codes/{code}` (yalnızca hiç kullanılmamışsa) |
| Bayiler | `GET/POST /admin/branches`, `GET/PATCH /admin/branches/{id}`, `POST /admin/branches/{id}/close`, `POST /admin/branches/{id}/reopen` |
| Araç modelleri | `GET/POST /admin/vehicle-models`, `GET/PATCH /admin/vehicle-models/{slug}`, `POST /admin/vehicle-models/{slug}/retire`, `POST /admin/vehicle-models/{slug}/restore` |
| Araçlar | `GET/POST /admin/vehicles`, `PATCH /admin/vehicles/{id}` (bayi, `active`) |
| Ek hizmetler | `GET /admin/extras`, `PATCH /admin/extras/{slug}` |
| Rezervasyonlar | `GET /admin/reservations`, `GET /admin/reservations/{number}`, `POST /admin/reservations/{number}/cancel` |
| Teklifler | `GET /admin/quotes`, `GET/PATCH /admin/quotes/{number}` |
| Mesajlar | `GET /admin/contact-messages`, `GET/PATCH /admin/contact-messages/{id}` |
| Şirketler ve Filom verisi | `/admin/companies/*`, `/admin/contracts/*`, `/admin/fleet-vehicles/*`, `/admin/invoices/*`, `/admin/fleet-expenses/*` ([FLEET.md](FLEET.md) §4) |
| Talepler | `GET /admin/requests`, `GET /admin/requests/{number}`, `POST /admin/requests/{number}/status` (`{ status, note?, assignee? }`) |
| Kullanıcılar | `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users/{id}/disable`, `POST /admin/users/{id}/enable` |
| İşlem kaydı | `GET /admin/audit-log` |

**Herkese açık uçlarda değişen:**
- `GET /branches` kapalı bayileri, `GET /vehicle-models` kaldırılmış modelleri döndürmez.
- `GET /me` cevabına `role` eklenir.
- `GET /products*` ve `/services` kalkar (ADR-32).

**Fotoğraf yükleme** API'den değil web sunucusundan yapılır (ADR-28): `POST /admin/vehicle-models` ve `PATCH` yalnızca dönen `imageUrl`'i alır, API izinli alan adını denetler.

## 5. Veri modeli değişiklikleri

| Model | Değişiklik | İş |
|---|---|---|
| `User` | `role Role @default(CUSTOMER)`, `disabledAt DateTime?`, `companyId String?` (+ firma alanları `Company`'ye taşınır) | V2-23, V2-33, V2-34 |
| `Session` | `lastUsedAt`, yönetici oturumu için kısa `expiresAt` | V2-10, V2-23 |
| `AuditLog` (yeni) | `id, at, actorId, companyId?, action` (ör. `branch.close`)`, entity, entityId, fields String[]`. Değer ve kişisel veri yazılmaz. Silinemez, panelden düzenlenemez | V2-23 |
| `PromoCode` | `maxRedemptions Int?`, `oncePerUser Boolean @default(true)`, `createdAt`, `updatedAt`; CHECK `percent BETWEEN 1 AND 90` | V2-05, V2-26 |
| `Branch` | `kind BranchKind` (`CITY`, `AIRPORT`), `closedAt DateTime?`, `createdAt`, `updatedAt` | V2-27 |
| `VehicleModel` | `retiredAt DateTime?`, `createdAt`, `updatedAt`; `imageUrl` izinli kaynak | V2-29 |
| `Vehicle`, `Extra` | `createdAt`, `updatedAt` | V2-11, V2-30 |
| `Reservation` | `updatedAt`, `cancelledAt`, `cancelReason String?`, `cancelledById String?` | V2-11, V2-31 |
| `QuoteRequest` | `internalNote String?`, `updatedAt`; `QuoteStatus`'a `CLOSED`; kaynak (`WEB`, `FLEET_RENEWAL`) | V2-32, V2-38 |
| `ContactMessage` | `handledAt DateTime?`, `handledById String?` | V2-32 |
| `Product` | Metin alanları kalkar, yalnızca `slug`; `Service` tablosu kalkar | V2-17 |
| `Company` ve Filom tabloları | [FLEET.md](FLEET.md) §5 | V2-33, V2-35, V2-37, V2-38 |
| `ServiceRequest`, `ServiceRequestEvent` | ADR-31 | V2-41 |

## 6. Güvenlik

- Yetki **API'de** denetlenir. Her `/admin` ucu için "oturumsuz 401, müşteri 403, yönetici 200" testi zorunludur.
- İşlem kaydı silinemez; kişisel veri değeri yazmaz.
- Paneldeki listeler kişisel veri gösterir (ad, e-posta, telefon); erişim yalnızca `ADMIN` rolüyle mümkündür. Okuma kaydı v2'de tutulmaz; [SECURITY.md](SECURITY.md)'de yazılır.
- CSRF: `SameSite=Lax` çerez, istekler web sunucusundan, JSON gövde; ek olarak JSON dışı içerik türüne `415`.
- Dosya yükleme kuralları ADR-28; yükleme action'ı yönetici oturumunu API'ye sorarak doğrular (`GET /me` → `role`).
- v2'de yok, sonraya: iki adımlı doğrulama (TOTP), ikinci rol, okuma kaydı, CSV içe/dışa aktarma.

## 7. Test

- **API:**
  - her uç için servis ve HTTP testleri: yetki 401/403/200, doğrulama 422, çakışma 409 `STALE_WRITE`, `IN_USE`;
  - veritabanlı entegrasyon testleri: bayi kapatma engeli, model kaldırma, rezervasyon iptalinde puan, kampanya kodu tavanı (eşzamanlı iki istek), kurumsal davet.
- **Web:** `USE_MOCKS=1` ile e2e:
  - yetkisiz 404;
  - bayi ekle → Bayilerimiz'de görün → kapat → kaybolsun;
  - model ekle (fotoğraf mock'u) → filo bölümünde görün;
  - kod ekle → özet sayfasında kullan;
  - rezervasyon iptali onay penceresi.
- **Canlı:** her faz sonunda G önizlemede bir tur yapar (WORKFLOW.md).
