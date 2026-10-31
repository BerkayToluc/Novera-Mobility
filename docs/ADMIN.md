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

### 3.8 Rezervasyonlar ekranı (V2-31)

`/yonetim/rezervasyonlar` (EN `/en/admin/reservations`) ve `/{numara}`; uçlar `GET /admin/reservations`, `GET /admin/reservations/{number}` ve `POST /admin/reservations/{number}/cancel`.

- **Liste** veritabanı sorgusudur (diğer ekranların küçük tablolarının aksine rezervasyon sürekli büyür): süzme, sıralama ve sayfalama veritabanında yapılır; bir sayfa bir sayım ve bir okumadır. Aynı `startAt`'a sahip rezervasyonlar `id` ile sıralanır, bir sayfa satır tekrarlamaz ya da atlamaz.
- **Arama** (`ara=`): rezervasyon numarasının ya da müşteri e-postasının bir parçası, büyük/küçük harf fark etmez. **Süzgeçler** adreste durur: `durum` (`CONFIRMED`, `CANCELLED`), `bayi` (alış bayisi), `bas` ve `bit` (kiralamanın **başladığı** günler, ikisi de dahil, **İstanbul takvimine göre**; `bit`, `bas`'tan önceyse API `422 INVALID_DATE_RANGE`, web adresinde bu iki değer ayıklanır). Varsayılan sıra en geç başlayan üstte.
- **Özet kartlarından gelen süzgeçler:** özetteki üç kart (V2-25) bu listeyi açar: `baslangic=bugun` (API `start=today`), `bitis=bugun` (`end=today`) ve `olusturma=7gun` (`created=last7days`); kartlar iptal edilmemişleri saydığı için bağlantı `durum=CONFIRMED` de taşır, böylece listenin toplamı kartın sayısıyla aynıdır. Pencereler özetle aynıdır (İstanbul günü; `olusturma` için bugün ve önceki altı gün). Ekran listenin üstünde hangi kartın açtığını söyler ve süzgeci kaldırma bağlantısı verir.
- **Liste satırı** müşterinin e-postasını gösterir (ad ve e-posta kişisel veridir: yalnızca ekranda ve API cevabında vardır, işlem kaydına yazılmaz). Hesabı silinmiş müşterinin rezervasyonu kalır, müşteri alanı boştur ("Hesap silinmiş"). Durum çipi tarihlerden türer: Yaklaşan, Sürüyor, Tamamlandı, İptal.
- **Ayrıntı**: kiralama bilgileri, fiyat dökümü (**oluşturulduğu anki** haliyle, kur ve fiyat sonradan değişse de aynı), kampanya kodu, harcanan ve kazanılan puan, müşteri ve hesap türü, araç (plaka dahil), iki bayi, iptal bilgisi.
- **İptal** (`POST .../cancel`, `{ reason }` 5–500 karakter, zorunlu): müşterinin kendi iptaliyle **aynı iptaldir**, ortak `claimCancellation` işlevidir (tek koşullu güncelleme: `CONFIRMED` ve `startAt > şimdi`). Puan, araç ve kod sonucu kayıtlara yazılmaz, durumdan türer; bu yüzden iki yol aynı sonucu verir: araç hemen yeniden müsait olur, harcanan puan geri döner, bekleyen puan düşer, kampanya kodunun kullanımı geri gelir. Farkı: `cancelReason` ve `cancelledById` (yönetici silinirse bağlantı boşalır, neden kalır) rezervasyona yazılır; müşterinin kendi iptalinde ikisi boştur. **Başlamış ya da zaten iptal edilmiş** rezervasyon `409 INVALID_TRANSITION` döner ve hiçbir şey değişmez (müşterinin kendi ucu `RESERVATION_NOT_CANCELLABLE` döner, değişmedi). Müşteri ile yönetici aynı anda iptal ederse biri kazanır, yavaş olan `409` alır.
- **İşlem kaydı:** `reservation.cancel`, varlık rezervasyon numarası, yalnızca alan adı (`reason`); neden metni işlem kaydında değil rezervasyondadır.
- **Veritabanı:** `cancelReason` 5–500 karakter CHECK (`NOT VALID`), `cancelledById` yabancı anahtar (`ON DELETE SET NULL`); migration `20261030160000_reservation_cancellation`.
- **Ekran:** iptal düğmesi yalnızca iptal edilebilir rezervasyonda vardır; başlamış ya da iptal edilmiş rezervasyonda ekran nedenini söyler. Onay penceresi nedeni sorar, varsayılan odak "Vazgeç"tir. E-posta V2-44'tedir.
- **Örnek veri (USE_MOCKS=1):** `mocks/admin-reservations.ts`, örnek hesabın beş rezervasyonunu panelin gözüyle gösterir; panelden yapılan iptal örnek filonun dünyasında (`mocks/fleet-world.ts`) tutulur ve müşterinin Rezervasyonlarım ekranı onu okur.

### 3.9 Teklif talepleri ve iletişim mesajları ekranları (V2-32)

`/yonetim/teklifler` ve `/{numara}` (EN `/en/admin/quotes`), `/yonetim/mesajlar` ve `/{id}` (EN `/en/admin/messages`); uçlar `GET /admin/quotes`, `GET/PATCH /admin/quotes/{number}`, `GET /admin/contact-messages` ve `GET/PATCH /admin/contact-messages/{id}`.

- **Teklif durumu** yalnızca ileri gider: `RECEIVED → IN_REVIEW → OFFERED → CLOSED`. İleri atlamak serbesttir (hemen yanıtlanan talep doğrudan `OFFERED` ya da `CLOSED` olabilir). **Geri gidiş** `409 INVALID_TRANSITION` döner ve hiçbir şey yazılmaz (aynı istekteki iç not da). Zaten içinde olduğu durumu istemek hata değildir, bir şey değiştirmez. Ekran yalnızca kalan durumların düğmesini gösterir ve her adımı, geri alınamadığı için, onay penceresiyle sorar (varsayılan odak "Vazgeç").
- **İç not** (`internalNote`, en çok 2000 karakter, CHECK ile de korunur) yalnızca çalışanın okuduğu nottur. **Müşteriye giden hiçbir cevapta yoktur**: `GET /me/quotes` cevabı alanları tek tek seçer (testte alan listesi sabitlenir). Boş metin ya da `null` notu siler. Durum ve not ayrı kaydedilir, ikisi de talebin `updatedAt` sürümüne karşı (`STALE_WRITE`); iki kişi aynı anda yazarsa biri kazanır, diğeri "Bu kayıt siz düzenlerken değişti" uyarısını alır ve yazdığı kaybolmaz.
- **Müşteri tarafı:** kurumsal kullanıcının "Teklif taleplerim" ekranı yeni durumu okur; `CLOSED` için "Kapandı" etiketi vardır (`QuoteStatus` enum'una `CLOSED` eklendi, openapi ve web tipleri güncel).
- **Kaynak** (`source`: `WEB` site formu, `FLEET_RENEWAL` Filom'dan sözleşme yenileme, V2-38): listede ve süzgeçte gösterilir.
- **Liste** veritabanı sorgusudur: arama numara, şirket adı ve e-postada (büyük/küçük harf fark etmez; İngiliz alfabesindeki harfler için, Ş gibi Türkçe büyük harfler yazıldığı gibi eşleşir), süzgeçler `durum` ve `kaynak`, adreste durur. Saklama süresi dolunca kişisel alanları silinen talep (`anonymizedAt`) listelenir ve "Silindi" yazar; şirket adı, durum ve tarihler kalır, iç not düzenlenebilir.
- **Mesaj "ele alındı" işareti** (`handledAt`, `handledById`) `PATCH { handled: true | false }` ile konur ve geri alınır. İki çağrı da tekrarlanabilir, bu yüzden sürüm gönderilmez: zaten ele alınmış mesaja tekrar işaret koymak **ilk işareti** (zaman ve kişi) korur, iki yönetici aynı anda basarsa biri yazar. Yönetici hesabı silinirse işaret kalır, kişi boşalır.
- **Bekleyen mesaj** = ele alınmamış **ve** kişisel alanları silinmemiş. Saklama süresi dolup silinmiş bir mesajda yanıtlanacak bir şey kalmadığı için sayılmaz (V2-25'ten devreden karar). `GET /admin/summary`'deki `unhandledMessages` artık `null` değildir, aynı kuralla sayar; `GET /admin/contact-messages?handled=false` de aynıdır, bu yüzden özetteki "Ele alınmamış mesaj" kartının sayısı kartın açtığı listenin toplamıyla aynıdır (`durum=ele-alinmadi`). Aynı şekilde "Yanıt bekleyen teklif talebi" kartı `durum=RECEIVED` ile listeyi açar.
- **Liste satırında** mesajın yalnızca ilk sözleri (`preview`, en çok 120 karakter) vardır; tamamı mesajın kendi sayfasındadır.
- **İşlem kaydı:** `quote.update` (varlık talep numarası, alanlar `updatedAt`, `status`, `internalNote`) ve `contact-message.handle` (varlık mesaj kimliği, alan `handled`). Not, müşteri adı, e-posta ve mesaj metni işlem kaydına yazılmaz.
- **Veritabanı:** `QuoteStatus`'a `CLOSED`, yeni `QuoteSource` enum'u, `QuoteRequest.source` ve `internalNote` (+ uzunluk CHECK, `NOT VALID`), `ContactMessage.handledAt`, `handledById` (yabancı anahtar, `ON DELETE SET NULL`) ve `handledAt` üzerinde indeks; migration `20261030170000_quotes_and_messages_admin`.
- **Örnek veri (USE_MOCKS=1):** `mocks/admin-quotes.ts` ve `mocks/admin-messages.ts`, örnek filonun dünyasında (`mocks/fleet-world.ts`) tutulur: dokuz talep (üçü bekliyor, üçü kurumsal örnek hesabın), altı mesaj (dördü bekliyor), özet kartı bunlarla aynı sayıyı gösterir. Kurumsal örnek hesabın "Teklif taleplerim" ekranı durumu aynı dünyadan okur.

### 3.10 Şirketler ekranı ve kurumsal davet (V2-33)

`/yonetim/sirketler`, `/yeni` ve `/{id}` (EN `/en/admin/companies`); uçlar `GET/POST /admin/companies`, `GET/PATCH /admin/companies/{id}`, `POST /admin/companies/{id}/users` ve `POST /admin/companies/{id}/users/{userId}/resend`.

- **Şirket** (`Company`): ad (2–120, **benzersiz**; büyük/küçük harf ve baştaki/sondaki boşluk fark etmez, `409 NAME_TAKEN`), vergi dairesi, şehir, telefon, satış temsilcisi (`{ name, email, phone }`: üçü birlikte ya da hiçbiri). Boşaltılan alan `null` gider ve siler. Değişiklik `updatedAt` sürümüne karşıdır (`STALE_WRITE`).
- **Davet:** `POST .../users` şirkete bağlı, şifresiz bir `CORPORATE` hesap açar ve **7 gün geçerli** bağlantıyı e-postayla yollar (`PasswordResetToken.kind = INVITE`, aynı tablo, ayrı metin ve süre). Bağlantı `/{dil}/sifre-sifirla/yeni?token=…&tur=davet` sayfasını açar: sayfa kişiyi karşılar, şifre belirlenince kurumsal giriş sekmesine (`/giris?tip=kurumsal`) götürür. Yönetici şifreyi hiçbir yerde görmez. Aynı e-posta (bireysel hesap dahil) `409 EMAIL_TAKEN`, hiçbir şey yazılmaz. E-posta gönderimi başarısız olsa da hesap ve bağlantı kaydedilir; yönetici daveti yeniden yollayabilir.
- **Yeniden gönder:** kişinin **tüm önceki bağlantıları geçersiz olur**, yenisi 7 gün yaşar. Şifresini belirlemiş (ya da Google ile bağlanmış) kişi için `409 INVALID_TRANSITION`.
- **Durum:** `PENDING` (şifre ve Google bağlantısı yok) ya da `ACTIVE`. Bekleyen kişide son davetin bitiş zamanı ve `expired` gelir; ekran "Davet bekliyor" / "Davetin süresi doldu" der.
- **Liste:** veritabanı sorgusu; arama ad, vergi dairesi ve şehirde; sıralama `name` (varsayılan), `users`, `createdAt`. Satırda kişi sayısı ve davet bekleyen sayısı.
- **Migration** `20261030180000_company_and_invite` yeni tabloyu açar ve **mevcut kurumsal hesapları taşır**: aynı firma adı (büyük/küçük harf ve boşluk fark etmez) tek `Company` olur; adı olmayan hesap şirketsiz kalır. Taşıma tekrarlanabilir (`DATA MOVE` bloğu) ve testle sabitlenmiştir: her hesap için `GET /me` cevabı öncesi ve sonrası birebir aynıdır. **Tek istisna issue'nun kuralıdır:** aynı ada sahip hesaplar firma bilgisinde ayrışıyorsa **en eski hesabın bilgileri** şirketin bilgileri olur, sonraki hesaplar onu okur.
- **Eski `User` firma alanları bu sürümde silinmez** (`companyName`, `taxOffice`, `companyCity`, `companyPhone`, `salesContact`): kod artık bunları okumaz ama yeni kod yayına çıkarken eski kodun çalıştığı kısa süre için kolonlar kalır (genişlet / daralt). Silme V2-34'te yapıldı (§3.11). `GET /me` biçimi değişmedi; alanlar şirketten doldurulur.
- **İşlem kaydı:** `company.create`, `company.update`, `company.invite`, `company.invite-resend` (varlık şirket kimliği, yalnızca alan adları). Kişinin adı ve e-posta adresi, şirketin bilgileri işlem kaydına yazılmaz.
- **Örnek veri (USE_MOCKS=1):** `mocks/admin-companies.ts`, dünya başına: Ege Lojistik A.Ş. (biri etkin, biri davet bekleyen iki kişi), Marmara Turizm Ltd. Şti. (bir kişi), Anadolu İnşaat A.Ş. (kişisiz).
- **KVKK:** davet e-postası ve kurumsal kullanıcı verisinin aydınlatma metnindeki yeri, V2-36'daki personel bölümüyle birlikte gözden geçirilecek.

### 3.11 Kullanıcılar ve İşlem kaydı ekranları (V2-34)

`/yonetim/kullanicilar` ve `/{id}` (EN `/en/admin/users`), `/yonetim/kayit` (EN `/en/admin/audit-log`); uçlar `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users/{id}/disable`, `POST /admin/users/{id}/enable` ve `GET /admin/audit-log`.

- **Liste:** veritabanı sorgusu; arama e-posta ve adlarda (birden çok sözcük yazılırsa her biri e-postada ya da adlardan birinde bulunmalı); süzgeçler `tur` (`INDIVIDUAL`, `CORPORATE`, `ADMIN`; yönetici hesabın türü bireysel olsa da bireysel sayılmaz) ve `durum` (`ACTIVE`, `DISABLED`) adreste durur; sıralama `createdAt` (varsayılan, en yeni üstte), `email`, `lastName`.
- **Detay:** giriş yöntemi (parola / Google / henüz yok), şirket ve görev, puan, rezervasyon sayısı ve bunlardan kaçının henüz başlamadığı.
- **Hesap kapatma (`User.disabledAt`):** kapatılan hesabın **tüm oturumları ve şifre sıfırlama bağlantıları silinir**, hesap kilitli satırda (`FOR UPDATE`) kapatılır, yani aynı anda giren bir oturum ya kapatmadan önce olur (ve silinir) ya da sonra olur (ve hesabı kapalı bulur). Parola girişi, Google girişi (bağlı da olsa, bağlanacak da olsa) ve oturumla istek `401 INVALID_CREDENTIALS` / oturumsuzluk döner: **cevap yanlış parolayla aynıdır**, hesabın kapalı olduğu sızmaz (parola doğruysa bile aynı iş ve aynı cevap, sayaç da artar). Kapalı hesaba "şifremi unuttum" bağlantısı gitmez (cevap hesabı olmayan adresle aynı), elde kalan bir bağlantı `RESET_TOKEN_INVALID` verir. Hesap ve rezervasyonları **silinmez; gelecek rezervasyonlar iptal edilmez**, sayısı ekranda ve kapatma penceresinde yazar. Zaten kapalı hesabı kapatmak hata değildir ve ilk tarihi korur; yeniden açma da tekrarlanabilir, bu yüzden sürüm gönderilmez. Yeniden açılan hesap eskisi gibi girer (oturumları silindiği için yeniden giriş yapar).
- **Yönetici kapatılamaz:** yönetici hesabı için `403 FORBIDDEN`; kendisi de başka bir yönetici de kapatılamaz. Yetki `pnpm admin:create --revoke` ile alınır. Ekran bu hesapta düğme yerine bunu söyler.
- **İşlem kaydı ekranı** salt okunurdur: `GET /admin/audit-log` dışında bir uç yoktur (`POST/PUT/PATCH/DELETE` `404`), veritabanı da satırın güncellenmesini ve silinmesini reddeder (V2-23). Her zaman en yeni üstte; süzgeçler `yonetici` (hesap kimliği ya da `cli`), `alan` (kaydın türü: `branch`, `reservation`, `user` ...) ve `bas`/`bit` (günler, ikisi de dahil, İstanbul takvimiyle). Satırda kim, ne zaman, ne yaptı, hangi kayıt ve **yalnızca alan adları** vardır. Kişinin adı ve e-postası satıra yazılmaz, okunurken hesaptan alınır; hesap sonradan silindiyse "Silinmiş hesap" yazar, `cli` "Komut satırı" yazar. Ekranın bilmediği bir işlem adı olduğu gibi gösterilir.
- **İşlem kaydı:** `user.disable`, `user.enable` (varlık hesap kimliği, alan yok). Hesabın e-postası ve adı yazılmaz.
- **Veritabanı:** `User.disabledAt`. Aynı migration'da (`20261031100000_user_disable_drop_company_columns`) V2-33'te taşınan eski firma sütunları (`companyName`, `taxOffice`, `companyCity`, `companyPhone`, `salesContact`) **düşer** (V2-33 genişletmişti, bu daraltmadır). Düşmeden önce bir koruma çalışır: şirketi olmayıp firma adı dolu kurumsal hesap varsa migration hata verip durur, veri sessizce kaybolmaz. V2-33'ün taşıma testleri bu sütunlara dayandığı için kaldırıldı; taşıma canlıda yapıldı ve `GET /me` testleri şirketten okuyor.
- **Örnek veri (USE_MOCKS=1):** `mocks/admin-users.ts`, dünya başına: altı hesap (yönetici, iki bireysel, iki kurumsal, biri kapalı) ve on bir satırlık kayıt. Örnek giriş kapalı hesabı yanlış parola gibi reddeder; panelden kapatma/açma kayda yazılır.

### 3.12 Sözleşmeler, filo araçları ve okumalar (V2-35)

Şirket sayfasında (`/yonetim/sirketler/{id}`) **Sözleşmeler** bölümü, sözleşmenin kendi sayfası `/yonetim/sirketler/{id}/sozlesmeler/{numara}` (EN `/en/admin/companies/{id}/contracts/{number}`). Uçlar `GET/POST /admin/companies/{id}/contracts`, `GET/PATCH /admin/contracts/{number}`, `POST /admin/contracts/{number}/vehicles`, `PATCH /admin/fleet-vehicles/{id}`, `POST /admin/fleet-vehicles/{id}/readings`.

- **Sözleşme** (`FleetContract`): numara `SZL-<yıl>-<5 hane>` bir veritabanı sequence'inden gelir (aynı anda açılan iki sözleşme aynı numarayı almaz), ürün (`Product.slug`), başlangıç ve bitiş günü (`date`, bitiş başlangıçtan sonra), aylık bedel **TRY kuruş** (ekranda lira yazılır: `45000`, `45000,50`), teslim şehri (81 ilden biri), durum `ACTIVE` / `ENDED`. Ürün ve başlangıç sonradan değişmez. Değişiklik `updatedAt` sürümüne karşıdır (`STALE_WRITE`). **Araçları hâlâ şirketin yanında olan sözleşme bitirilmez** (`409 IN_USE`, `details.vehicles`); önce araçlar iade edilir. Bitmiş sözleşmeye araç eklenmez.
- **Filo aracı** (`FleetVehicle`): model, plaka (`34 ABC 123` biçiminde saklanır, nasıl yazılırsa yazılsın), model yılı, başlangıç km, sonraki bakım ve muayene günü. **Plaka hem filo araçlarında hem kiralık araçlarda benzersizdir** (`409 PLATE_TAKEN`, alan `plate`); ikincisi serviste denetlenir. Araç sözleşmenin şirketine bağlanır; veritabanı bileşik yabancı anahtarlarla şirketler arası bağı da reddeder.
- **İade:** `PATCH ... { returned: true }` aracı kullanımdan çıkarır (`RETURNED`, `returnedAt`) ve **açık zimmetini aynı anda kapatır**. Araç silinmez; zimmet ve okuma geçmişi şirketindir. İade edilmiş araç değişmez, ona okuma girilmez (`409 INVALID_TRANSITION`). Ekran iadeyi onay penceresiyle sorar (varsayılan odak "Vazgeç").
- **Okuma** (`VehicleReading`): km, yakıt %, şarj %, batarya sağlığı % (yüzdeler 0–100, isteğe bağlı; veritabanı CHECK'i de var). **Kilometre geri gitmez** ve okuma bir öncekinden eski olamaz (`422 OUT_OF_RANGE`); gelecekteki zaman olmaz. Aracın "son km"'si son okumadan gelir, okuma yoksa başlangıç km'sidir.
- **Listeleme:** bir şirketin birkaç sözleşmesi olur, bu yüzden şirketin sözleşme listesi sayfalamaz. Sözleşmenin araçları `GET /admin/contracts/{number}` cevabında gelir (FLEET.md §4.2'deki ayrı `GET .../vehicles` yazılmadı).
- **İşlem kaydı:** `contract.create`, `contract.update` (şirket satırda), `fleet-vehicle.create`, `fleet-vehicle.update`, `fleet-vehicle.reading`. Plaka ve rakamlar (değerler) yazılmaz, yalnızca alan adları.
- **Veritabanı:** migration `20261031120000_fleet_data`: `CompanyEmployee`, `FleetContract`, `FleetVehicle`, `VehicleAssignment`, `VehicleReading`; CHECK'ler (`endAt > startAt`, bedel > 0, km >= 0, plaka biçimi, yüzdeler, zimmet tarihleri), araç başına tek açık zimmet için **kısmi benzersiz indeks**, `FleetContractNumber_seq`.
- **Örnek veri (USE_MOCKS=1):** `mocks/admin-contracts.ts`, dünya başına: Ege Lojistik A.Ş.'nin Akıllı Kurumsal Filo sözleşmesi (biri Ayşe Demir'de, biri boşta iki araç). Seed için bkz. FLEET.md §5 ve `FLEET_SEED_PASSWORD`.

### 3.13 Filom veri uçları (V2-35)

Müşteri tarafının `/fleet/*` uçları `CompanyGuard` arkasındadır (FLEET.md §4.1; ekranları V2-36 yapar): `GET /fleet/summary`, `GET /fleet/vehicles` ve `/{plaka}`, `GET /fleet/contracts` ve `/{numara}`, `GET/POST /fleet/employees`, `GET/PATCH /fleet/employees/{id}`, `GET/POST /fleet/assignments`, `POST /fleet/assignments/{id}/end`.

- **Kapı:** global `CompanyGuard` (`AdminGuard` gibi: `/fleet/*` altına sonradan eklenen bir denetleyici onu unutamaz; yol büyük/küçük harfe duyarsızdır). Oturum yoksa `401`; **bireysel hesap, yönetici hesabı ve şirketi olmayan kurumsal hesap `403`**. Sınır: hesap başına dakikada 120 (`fleet:<id>`).
- **Şirket ayrımı:** her servis şirketi ilk parametre olarak alır ve her sorguyu onunla süzer; **başka şirketin kaydı `404`** (olmayan kayıtla aynı cevap). Gövdede verilen başka şirketin araç ya da personeli de olmayanla aynı cevabı alır (`422 UNKNOWN_REFERENCE`), yani cevap diğer şirketlerin neleri olduğunu söylemez. Testle sabit.
- **Zimmet:** araç başına tek açık zimmet: servis önce bakar (`409 VEHICLE_ASSIGNED`), aynı anda gelen iki istekte araç satırı kilitlenir ve veritabanındaki kısmi benzersiz indeks son sözü söyler. Pasif personele zimmet verilmez, iade edilmiş araç verilmez, başlangıç gelecekte ve aracın önceki zimmetinin bitişinden önce olamaz. Zimmeti biten araç yeniden boştadır; geçmiş silinmez.
- **Personel:** kimse silinmez, `active: false` olur ve **açık zimmeti aynı anda kapanır**. Aynı şirkette aynı sicil no iki kişide olmaz (`409 EMPLOYEE_NO_TAKEN`; başka şirketin aynı numarası engel değil). Ehliyet bilgisi saklanmaz. Personel kişisel veridir: yalnızca o şirketin kullanıcıları ve yönetici görür.
- **İşlem kaydı:** `fleet-employee.create`, `fleet-employee.update`, `fleet-assignment.create`, `fleet-assignment.end`; **aktör müşteri hesabı, satırda `companyId` dolu**, yalnızca alan adları (Yönetim > İşlem kaydı'nda görünür).
- **Özet:** `hasActiveContract`, araç sayıları (kullanımda / zimmetli / boşta), 60 gün içinde biten etkin sözleşmeler, bakımı ya da muayenesi 30 gün içinde (ya da geçmiş) olan araçlar. Fatura kartları V2-37'de (§3.15), masraf kartı V2-38'de (§3.16) eklendi; talepler kartı V2-41'de eklenir.

### 3.14 Filom ekranları: Özet, Araçlar, Personel, Zimmet, Sözleşmeler (V2-36)

Adresler (TR / EN): `/filom` / `/en/my-fleet`, `/filom/araclar` ve `/{plaka}` (`/my-fleet/vehicles`), `/filom/personel`, `/yeni` ve `/{id}` (`/my-fleet/employees`), `/filom/zimmet` (`/my-fleet/assignments`), `/filom/sozlesmeler` ve `/{numara}` (`/my-fleet/contracts`). Metinler `messages/*/fleet-panel.json` (`FleetPanel`).

- **Kapı** (`app/[locale]/filom/layout.tsx`, sunucuda): oturum yoksa kurumsal girişe (`/giris?tip=kurumsal&sonra=filom`, giriş sonrası `/filom`'a döner; `sonra` sabit bir sözcüktür, adres değildir); **bireysel hesap ve yönetici hesabı `404`** (Filom'un var olduğu bile doğrulanmaz); sözleşmesi olmayan kurumsal hesap ekranlar yerine **boş durum ve "Kurumsal teklif al" (`/kurumsal-teklif`)** görür, bu `/filom` altındaki her adres için aynıdır. Hepsi `noindex`. Gerçek koruma API'dedir; sayfaların verisi API'den gelir ve API reddeder.
- **Giriş noktası:** kurumsal profilin menüsünde, yalnızca `hasFleet` olan hesapta "Filom" (`GET /me`'deki `hasFleet`: şirketin etkin bir sözleşmesi var; kurumsal hesap oturumuyla birlikte tek küçük sorguyla gelir). Bireysel hesapta ve sözleşmesiz şirkette yoktur.
- **Özet:** kullanımdaki / zimmetli / boşta araç, etkin sözleşme, 60 gün içinde biten sözleşme, bakımı ya da muayenesi 30 gün içinde olan araç. Kullanımdaki, zimmetli, boşta ve etkin sözleşme kartlarının sayısı, açtıkları listenin toplamıyla aynıdır (aynı süzgeç); "60 gün içinde biten" ve "bakımı yaklaşan" kartları ilgili listeyi (etkin sözleşmeler, kullanımdaki araçlar) açar ve sayıları onun bir alt kümesidir. Fatura kartları V2-37'de eklendi (§3.15, "Bu ayın faturası" ve "Ödenmemiş fatura toplamı"); "Açık masraf" kartı V2-38'de eklendi (§3.16); talep kartı V2-41'de eklenir.
- **Araçlar:** liste (plaka, model, kimde, son km, durum; süzgeç `durum` ve `zimmet`, arama plaka ve modelde, plaka nasıl yazılırsa yazılsın). Detay `/{plaka}` (boşluksuz da olur): bilgiler (bakım ve muayene için kalan gün), **zimmet** (boştaysa "Aracı ver" formu, kimdeyse "Aracı geri al" ve onay penceresi; zimmetli araca ikinci kişi verilemez, form yoktur), zimmet geçmişi, son 10 okuma. İade edilmiş araç kimseye verilemez.
- **Personel:** liste, ekleme (`/yeni`), kişinin sayfası (düzenleme ve **Pasifleştir**). Pasifleştirme onay ister ve kişinin elindeki araç varsa onu söyler: **araç hemen geri gelir** (API zimmeti aynı adımda kapatır). Pasif kişiye araç verilmez; yeniden etkinleştirmek tek basıştır. Ehliyet bilgisi istenmez. Formun altında bilgilerin kime görüneceği ve verinin Novera tarafından şirket adına işlendiği yazar.
- **Zimmet** (`/filom/zimmet`): tüm zimmetlerin kaydı, en yeni başlayan üstte, süzgeç `durum` (açık / kapanmış); satır aracın sayfasına gider. Vermek ve geri almak aracın sayfasındadır.
- **Sözleşmeler:** liste ve detay (araçlar, kimde). Aylık bedel ₺ ve "Tutarlar TL olarak gösterilir" notu, kullanıcının para birimi tercihinden bağımsız. Yenileme talebi V2-38'de.
- **Dar ekran:** tablolar kendi kutusunda yatay kayar (admin paneliyle aynı DataTable), yönetim paneliyle aynı çerçeve ve menü; 375 px'te sayfa yana kaymaz. Her ekran yükleniyor, boş ve hata durumunu gösterir.
- **KVKK:** aydınlatma metnine "Kurumsal müşterilerin personel bilgileri" bölümü eklendi (`legal.json`, TR/EN): veri sorumlusu kurumsal müşteridir, Novera veri işleyendir, ehliyet bilgisi alınmaz, yalnızca o şirketin kullanıcıları ve yönetim görür. Metni Berkay onaylar.
- **Örnek veri (USE_MOCKS=1):** `mocks/fleet-panel.ts` (kişiler ve zimmetler; sözleşme ve araçlar `mocks/admin-contracts.ts`'ten, yani yönetim ekranıyla aynı veri). Örnek kurumsal hesap Ege Lojistik A.Ş.'dir (iki araç, beş kişi; biri pasif); `novera-mock-session=corporate-nofleet` sözleşmesiz Anadolu İnşaat'ın hesabıdır (boş durum).

### 3.15 Faturalar (V2-37)

Adresler (TR / EN): Yönetim'de `/yonetim/faturalar` ve `/{numara}` (`/admin/invoices`); Filom'da `/filom/faturalar` ve `/{numara}` (`/my-fleet/invoices`). Metinler `messages/*/admin.json` (`Admin.invoices`) ve `fleet-panel.json` (`FleetPanel.invoices`, `.invoice`, `.summary.invoices`).

**Hesaplama kuralı** (`apps/api/src/fleet/invoice-calc.ts`, saf fonksiyonlar; seed ve testler de bunu kullanır):

- Bir fatura **bir şirketin bir ayı** içindir (dönem `2026-10`). Veritabanında `(companyId, period)` benzersizdir.
- Bir sözleşme, ayda kapsadığı günler kadar faturalanır: sözleşmenin başlangıç gününün ve ayın 1'inin **geç olanından**, bitiş gününün ve ayın son gününün **erken olanına** kadar, **iki uç gün dahil**. Aya hiç değmeyen sözleşmenin satırı yoktur. Sözleşmenin durumuna değil tarihlerine bakılır (erken bitirmek, bitiş gününü faturalanacak son güne çekmektir).
- Satır tutarı = aylık bedel × kapsanan gün ÷ ayın gün sayısı, **kuruşa yarım yukarı** yuvarlanır (yalnız tamsayıyla). Tam ay, aylık bedelin kendisidir. Şubat ve artık yıl ayın gün sayısından gelir.
- Ara toplam = satırların toplamı, yani **satırlar faturayla kuruşu kuruşuna tutar**. KDV = ara toplamın %20'si, yarım yukarı kuruşa. Toplam = ara toplam + KDV (veritabanı bunu `CHECK` ile de ister).
- Düzenlenme günü faturayı kestiğiniz gündür (İstanbul takvimi), **son ödeme 30 gün sonradır**. Para TRY kuruş.
- **Durum saklanmaz.** `PAID` ödenme zamanı varsa; `OVERDUE` ("Gecikti") ödenmemiş ve son ödeme günü bugünden önceyse (son ödeme günü kendisi gecikmiş sayılmaz); yoksa `PENDING` ("Bekliyor"). Okunurken hesaplanır.

**Oluşturma** (`POST /admin/invoices/generate?period=YYYY-MM`, gövdesiz): o ayda sözleşmesi olan her şirkete bir fatura, hepsi **tek işlemde ve ay kilitli** (`pg_advisory_xact_lock`) kesilir. Ay zaten kesilmişse **`409 ALREADY_GENERATED`** ve hiçbir şey değişmez (iki istek aynı anda gelirse biri kazanır). Başlamamış ay `422` `period: OUT_OF_RANGE`, ay olmayan değer `INVALID_FORMAT`. Kesilecek sözleşme yoksa hiçbir şey oluşmaz (`created: 0`). Numara `FTR-<yıl>-<5 hane>`, bir sequence'ten (`FleetInvoiceNumber_seq`) gelir. Faturalar buradan silinmez ve tutarları değişmez; değişen tek şey ödendi işaretidir.

**Ödendi işareti** (`PATCH /admin/invoices/{numara}`, `{ updatedAt, paid }`): satır kilitlenir, sürüm uyuşmazsa `409 STALE_WRITE`. `paid: true` ödenme zamanını yazar, `false` siler; zaten o durumdaysa bir şey değişmez ve hata da vermez.

- **İşlem kaydı:** `invoice.generate` (kayıt kimliği = ay, alan yok) ve `invoice.update` (kayıt kimliği = fatura numarası, `companyId` dolu, yalnız alan adları). Okumalar kaydedilmez.
- **Yönetim ekranı** (`/yonetim/faturalar`): üstte **dönem seçimi** (bu ay ve önceki on bir) ve "Faturaları oluştur"; onay penceresi ayı söyler ("Ekim 2026 faturaları oluşturulsun mu?"), sonuç "N fatura oluşturuldu" ya da "zaten oluşturulmuş" uyarısıdır. Altında liste (numara, şirket, dönem, düzenlenme, son ödeme, toplam, durum; süzgeç `durum`, arama numara ve şirket adında, sıralama düzenlenme / son ödeme / numara / toplam). Detayda fatura belgesi ve **Ödendi olarak işaretle / Ödeme işaretini kaldır**; eski ekrandan yapılan işaret başkasının değişikliğinin üstüne yazmaz (`STALE_WRITE` bildirimi, sayfa yenilenir).
- **Filom ekranı** (`/filom/faturalar`): şirketin faturaları (en yeni dönem üstte; süzgeç `durum`, sıralama dönem / son ödeme / toplam). Detayda aynı belge: şirket, numara, dönem, tarihler, durum, **sözleşme bazında satırlar** (gün / ayın günü), ara toplam, **KDV (%20)**, toplam ve **"Bu bir örnek faturadır, yasal belge (e-fatura) değildir."** notu. Müşteri faturayı işaretleyemez. **Başka şirketin faturası `404`** (API her sorguyu şirkete göre süzer, ADR-25).
- **Filom Özet:** "Bu ayın faturası" (tutar, numara, durum; kesilmediyse "Henüz kesilmedi") ve "Ödenmemiş fatura toplamı" (kaç tane, kaçı gecikmiş) kartları, `GET /fleet/summary`'deki `invoices` bloğundan gelir.
- **Yazdırma:** detayda "Yazdır" düğmesi `window.print()` çağırır. `@media print` kuralları (`app/globals.css`) site başlığını, altbilgiyi, atlama bağlantısını, Filom/Yönetim menüsünü ve düğmeleri gizler; fatura A4'te siyah beyaz, kenarlıksız, **tek sayfa** olur (tema koyu olsa da). e2e'de `emulateMedia("print")` ile öğeler ve Chromium'da PDF'in sayfa sayısı (1) denetlenir.
- **Örnek veri:** seed her sözleşmeli şirkete **önceki üç ayın faturasını** ekler (en eskisi ödendi; ilk şirketin ortadaki faturası gecikmiş, geri kalanlar bekliyor); yeniden çalıştırınca kopya yapmaz. Sample mod (`USE_MOCKS=1`) `mocks/invoices.ts`: Ege Lojistik'in üç faturası (ödendi, gecikmiş, bekliyor), tarihler bugüne göre kayar; bir ay bir kez kesilir, durum aynı kuralla hesaplanır.

### 3.16 Filo masrafları ve sözleşme yenileme talebi (V2-38)

Adresler (TR / EN): Yönetim'de `/yonetim/filo-masraflari` (`/admin/fleet-expenses`); Filom'da `/filom/masraflar` (`/my-fleet/expenses`) ve sözleşme detayında "Yenileme talebi gönder". Metinler `messages/*/admin.json` (`Admin.fleetExpenses`) ve `fleet-panel.json` (`FleetPanel.expenses`, `.contract.renewal`, `.summary.expenses`).

**Veri:** `FleetExpense` (tür `HGS` / `PENALTY` / `MAINTENANCE` / `OTHER`, an, tutar TRY kuruş, açıklama, yer, durum `OPEN` / `REFLECTED` / `DISPUTED`). Araç ve şirket bileşik yabancı anahtarla bağlıdır; tutar `CHECK > 0`. Personel **saklanmaz**.

**Masrafın personeli** (`apps/api/src/fleet/expense-calc.ts`, saf fonksiyon; seed ve sample mod da aynı kuralı kullanır): masrafın `occurredAt` anında aracın zimmeti kimdeyse odur. Zimmet `[başlangıç, bitiş)` aralığıdır: **devir anının kendisi yeni alan kişiye** aittir, bir milisaniye öncesi eskisine. İlk zimmetten önce ya da iki zimmet arasındaki boşlukta kimse yoktur ("Atanmamış"). Her okunuşta hesaplanır, hiçbir yerde saklanmaz (ADR-25); bu yüzden zimmet geriye dönük düzeltilirse masrafın kişisi her durumda onunla birlikte değişir. _Not: FLEET.md §3.1'in eski metni bunu yalnız "Açık" masraflar için söylüyordu; yansıtılmış masrafın kişisini dondurmak kişiyi saklamayı gerektirir ve §5 / ADR-25 ile çelişir, bu yüzden hesap her durumda geçerlidir. Dondurma istenirse ayrı bir karardır._

**Durum geçişleri (müşteri):** `OPEN → DISPUTED`, `DISPUTED → OPEN`, `OPEN → REFLECTED`. **Yansıtılmış masraf kesindir.** İtiraz edilmiş masraf önce Açık'a alınmadan yansıtılamaz. O anda kimse aracı kullanmıyorsa masraf yansıtılamaz (`409 INVALID_TRANSITION`). Zaten o durumdaki masrafa aynı durum istenirse bir şey değişmez ve hata da verilmez. Satır kilitlenir; sürüm uyuşmazsa `409 STALE_WRITE`.

**Toplu yansıtma** (`POST /fleet/expenses/reflect`, `{ ids }`, en çok 100): kimliklerden biri şirketin değilse ya da yoksa **tümü `404` ile reddedilir ve hiçbir şey değişmez** (ikisi ayırt edilemez; satırlar kimlik sırasıyla kilitlenir). Şirketin kendi masraflarından yalnızca **Açık olup o anda kişisi olanlar** yansıtılır; kalanlar olduğu gibi kalır ve cevapta nedenle sayılır (`NOT_OPEN`, `NO_ASSIGNEE`).

**Yönetim:** `GET/POST /admin/fleet-expenses`, `GET/PATCH /admin/fleet-expenses/{id}`. Giriş **plakayla** yapılır (boşluksuz ya da küçük harfle de olur); plaka bir filo aracına çözülür ve masrafın şirketi aracın şirketidir, seçilemez. Bilinmeyen plaka `422` `plate: UNKNOWN_REFERENCE`, gelecekteki an `occurredAt: OUT_OF_RANGE`. İade edilmiş araca da masraf girilir (araç dışarıdayken oluşmuş olabilir). Düzeltme (`PATCH`): tür, an, tutar, açıklama, yer; araç değişmez (yanlış araca girilen masraf yeniden girilir); yansıtılmış masraf `409 INVALID_TRANSITION`. _Düzeltme ucu API'de vardır ve testlidir; ekranda şimdilik yalnız giriş formu ve liste vardır._

**Sözleşme yenileme talebi** (`POST /fleet/contracts/{numara}/renewal-request`, gövde isteğe bağlı `{ vehicleCount?, durationMonths?, notes? }`): sözleşmenin ürünüyle, kullanımdaki araç sayısıyla (en az 1) ve süresiyle bir `QuoteRequest` açar, `source = FLEET_RENEWAL`; yönetim panelinde Teklifler'de görünür. Notun ilk satırı `Renewal of contract <numara>` olur: teklifin sözleşme sütunu olmadığı için sözleşmeye bağlayan budur. **İşlemde (kapatılmamış) bir yenileme talebi olan sözleşme için ikincisi `409 ALREADY_REQUESTED`**. Başka şirketin sözleşmesi `404`. `201` ve `{ received, referenceNumber }` döner.

- **İşlem kaydı:** `fleet-expense.create` ve `fleet-expense.update` (yönetim; `companyId` dolu); müşteri hesabıyla `fleet-expense.update`, `fleet-expense.reflect` (kayıt kimliği yok, alan adı `ids`) ve `fleet-contract.renewal-request` (kayıt kimliği sözleşme numarası). Yalnızca alan adları yazılır; tutar ve plaka yazılmaz.
- **Yönetim ekranı** (`/yonetim/filo-masraflari`): üstte giriş formu (plaka, tür, an İstanbul saatiyle, tutar TL olarak yazılır kuruş gider, açıklama, yer); altında liste (an, plaka, şirket, tür, tutar, personel, durum; süzgeç `tur` ve `durum`, arama plakada, sıralama an / tutar).
- **Filom ekranı** (`/filom/masraflar`): liste (an, araç, tür, tutar, **o anda zimmetli personel** ya da "Atanmamış", durum); süzgeçler tür, durum, araç, personel (ya da `yok`), ilk-son gün (İstanbul günü, ikisi dahil); sıralama an / tutar. Satır seçimi yalnızca **Açık ve kişisi olan** masrafta açıktır; "Personele yansıt (N)" düğmesi onay penceresi açar. Satırda "İtiraz et" / "İtirazı geri al". Uydurma bir adres (`arac=x`, `bas=bugun`) hata değil listeyi gösterir.
- **Filom Özet:** "Açık masraf" kartı (sayı ve toplam), `GET /fleet/summary`'deki `expenses.open` bloğundan; `?durum=OPEN` ile masraflar listesini açar.
- **Sözleşme sayfası:** etkin sözleşmede "Sözleşmeyi yenile": isteğe bağlı not (en çok 500 karakter) ve "Yenileme talebi gönder"; gönderilince başvuru numarası yazar, işlemde bir talep varsa bunu söyler.
- **Örnek veri:** seed her şirkete 20 masraf ekler (toplam 40: çoğu HGS, her on masraftan ikisi ceza, biri bakım; bir kısmı itirazlı, zimmeti olan araçlarda bir kısmı yansıtılmış); yeniden çalışınca kopya yapmaz. Sample mod `mocks/expenses.ts`: Ege Lojistik'in dokuz masrafı (5'i Ayşe Demir'in, 2'si Burak Yılmaz'ın, 2'si kimsenin).

## 4. API

Tüm uçlar `/admin` önekli, `AdminGuard` arkasında, ADR-24 kurallarıyla (sayfalama, `STALE_WRITE`, yeni hata kodları). Değiştiren her istek işlem kaydına yazılır, `Content-Type: application/json` dışındakiler `415` döner, sınır dakikada 120/yönetici.

| Alan | Uçlar |
|---|---|
| Özet | `GET /admin/summary` |
| Kampanya kodları | `GET/POST /admin/promo-codes`, `GET/PATCH /admin/promo-codes/{code}`, `DELETE /admin/promo-codes/{code}` (yalnızca hiç kullanılmamışsa) |
| Bayiler | `GET/POST /admin/branches`, `GET/PATCH /admin/branches/{id}`, `POST /admin/branches/{id}/close`, `POST /admin/branches/{id}/reopen` |
| Araç modelleri | `GET/POST /admin/vehicle-models`, `GET/PATCH /admin/vehicle-models/{slug}`, `POST /admin/vehicle-models/{slug}/retire`, `POST /admin/vehicle-models/{slug}/restore` |
| Araçlar | `GET/POST /admin/vehicles`, `PATCH /admin/vehicles/{id}` (bayi, `active`) |
| Faturalar | `POST /admin/invoices/generate?period=YYYY-MM` (aynı ay ikinci kez `409 ALREADY_GENERATED`), `GET /admin/invoices`, `GET/PATCH /admin/invoices/{numara}` (ödendi işareti) |
| Filo masrafları | `GET/POST /admin/fleet-expenses`, `GET/PATCH /admin/fleet-expenses/{id}` (plakayla giriş; yansıtılmış masraf kesin) |
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
