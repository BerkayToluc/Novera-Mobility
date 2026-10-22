> **Arşiv (v1, 22 Ekim 2026'da taşındı).** Bu belge artık güncellenmez; yalnızca referanstır. Güncel belgeler için [docs/README.md](../../README.md). Göreli bağlantılar taşınmadan önceki konuma göre yazılmıştır.

# Yönetim paneli (tasarım)

> Durum: **Taslak v0.1** · 20 Ekim 2026 · Sahipler: Berkay (backend), G (frontend)
> Kapsam kararı SPEC §2.11'de (v0.11), mimari karar ARCHITECTURE ADR-24'te, iş sırası [ROADMAP.md](ROADMAP.md)'de.
> Bu belge "ne yapılacak ve nasıl" sorusunu cevaplar. Uçların kesin biçimi her işin PR'ında `docs/api/openapi.yaml`'a yazılır; çelişki olursa sözleşme kazanır.

## 1. Ne bu, ne değil

**Yönetim paneli**, Novera çalışanlarının siteyi koddan bağımsız yönettiği iç ekranlardır: ürün ve hizmet metinleri, kampanya kodları, SSS, kiralık filo, rezervasyonlar, teklif talepleri, iletişim mesajları, kullanıcılar ve **kurumsal müşteriler** (şirket, sözleşme, filo aracı, fatura, masraf).

Sitede iki panel vardır, ikisi de v0.11'de kapsama girdi:

| Ad | Ne | Belge |
|---|---|---|
| **Yönetim paneli** (`/yonetim`) | Novera çalışanının iç aracı | Bu belge |
| **Filom** (`/filom`) | Kurumsal müşterinin filo paneli; SPEC Ek A'da "Novera Admin Paneli" diye satılan ürün (zimmet, sözleşme, fatura, HGS ve ceza, raporlar) | [FLEET.md](FLEET.md) |

Filom'un verisini (sözleşme, filo aracı, fatura, masraf) Novera çalışanı bu panelden girer; müşteri Filom'da görür ve kendi tarafını (personel, zimmet, masrafı personele yansıtma) yönetir (FLEET.md §1). Ekranda karışmasın diye Novera'nın paneli **Yönetim paneli**, müşterininki **Filom** adını taşır; "Admin Paneli" yalnızca ürün sayfasındaki pazarlama adıdır.

**v1'de yok** (bilerek; Filom'un kapsam dışıları FLEET.md §1'de): dosya yükleme (görseller depoya yine PR ile girer, panel yalnızca yolu seçer), çoklu rol (yalnızca `ADMIN`), iki adımlı doğrulama (bkz. §8, sonraya), toplu içe/dışa aktarma, raporlar ve grafikler, kampanya galerisi ve iş ortağı logoları (SPEC §10'daki "kampanya içeriği sabit mi" kararı açık kalır), sayfa iskeleti metinleri (başlıklar, düğmeler, rakamlar bandı: çeviri dosyasında kalır).

## 2. Kim girer

- **Rol:** `User.role` alanı, değerleri `CUSTOMER` (varsayılan) ve `ADMIN`. Hesap türünden (`accountType`: bireysel/kurumsal) ayrıdır.
- **Yönetici hesabı siteden açılmaz.** Kayıt, Google ile giriş ya da panelin kendisi rol veremez. Berkay komut satırından açar:
  ```
  cd apps\api
  $env:DATABASE_URL = '<Neon adresi>'
  pnpm admin:create --email yonetici@novera.example --name "Ad Soyad"
  Remove-Item Env:DATABASE_URL
  ```
  Komut parolayı ekrandan ister (sohbete, dosyaya ya da geçmişe yazılmaz), en az 12 karakter şartı vardır. Aynı komut `--revoke` ile rolü geri alır.
- **Giriş:** normal `/giris` sayfası, e-posta + parola. Yönetici hesabında **Google ile giriş kapalıdır** (`403 GOOGLE_NOT_ALLOWED`); hesap bağlama yöneticinin parolasını silerdi (bkz. SECURITY.md, Google ile giriş).
- **Oturum:** yöneticinin oturumu 30 gün değil **12 saat** sürer. Rol geri alınınca açık oturumları kapanır.
- **Yetkisi olmayan:** `/yonetim/*` sayfaları sunucuda rol bakar. Giriş yoksa `/giris?next=/yonetim`, giriş var ama rol yoksa **404** (sayfanın varlığı belli edilmez). API tarafında `/admin/*` uçları oturum yoksa `401`, rol yoksa `403 FORBIDDEN` döner.

## 3. Ekranlar

Adres TR `/yonetim/...`, EN `/en/admin/...` (`i18n/routing.ts`). Tüm sayfalar `noindex`, sitemap ve `llms.txt` dışında, navbar ve footer'da bağlantı yok. Yönetici giriş yaptığında profil menüsünde tek bir "Yönetim paneli" bağlantısı görünür.

Yerleşim: solda menü (xl), dar ekranda üstte açılır menü; içerik alanında başlık, tek birincil düğme (ör. "Yeni ürün"), liste ya da form. Site tasarım token'larını kullanır; ayrı tema yok. Mobilde kullanılabilir olmalı ama öncelik 1280 px (çalışan masaüstünde kullanır); 375 ve 768'de taşma olmaz, tablo kutusunda yatay kayar.

| Ekran | Adres | Ne yapılır |
|---|---|---|
| Özet | `/yonetim` | Bugün başlayan ve biten kiralamalar, son 7 günün rezervasyon sayısı, yanıt bekleyen teklif ve mesaj sayısı (her biri ilgili listeye süzgeçli bağlantı) |
| Ürünler | `/yonetim/urunler`, `/yonetim/urunler/:slug` | Liste (sıra, yayında mı, öne çıkan), düzenle, yeni, yayından kaldır, sırayı değiştir |
| Hizmetler | `/yonetim/hizmetler`, `/yonetim/hizmetler/:slug` | Ürünlerle aynı; ek olarak hangi paketlerde ve hangi ürünlerde olduğu |
| Rezervasyonlar | `/yonetim/rezervasyonlar`, `.../:numara` | Ara (numara, e-posta), süz (durum, alış bayisi, tarih aralığı), detay (fiyat dökümü, kod, puan), iptal |
| Teklif talepleri | `/yonetim/teklifler`, `.../:numara` | Liste, durum değiştir, iç not |
| Mesajlar | `/yonetim/mesajlar`, `.../:id` | İletişim formu mesajları, "ele alındı" işareti |
| Kampanya kodları | `/yonetim/kampanya-kodlari` | Liste, yeni, düzenle (yüzde, tarih aralığı, etkin) |
| SSS | `/yonetim/sss` | Soru/cevap (TR/EN), kitle, konu, sıra |
| Kiralık filo | `/yonetim/filo/modeller`, `/bayiler`, `/araclar`, `/ek-hizmetler` | Model fiyatı ve açıklaması, görsel yolu; bayi bilgileri ve çalışma saatleri; araç (plaka, yıl, bayi, etkin); ek hizmet adı ve fiyatı |
| Kullanıcılar | `/yonetim/kullanicilar`, `.../:id` | Ara, detay (rezervasyonlar, puan, şirketi), hesabı devre dışı bırak / aç |
| Kurumsal müşteriler | `/yonetim/sirketler`, `.../:id` | Şirket bilgisi, kullanıcılarını davet et (kurumsal hesap açma), sözleşmeler (FLEET.md §4) |
| Filo sözleşmeleri ve araçları | `/yonetim/sirketler/:id/sozlesmeler/:numara` | Sözleşmenin filo araçları (ekle, iade), bakım ve muayene tarihleri, kilometre/batarya okuması girişi |
| Faturalar | `/yonetim/faturalar` | Dönem seç → "Faturaları oluştur", liste, ödendi işareti |
| Filo masrafları | `/yonetim/filo-masraflari` | HGS, ceza, bakım kaydı girişi (plakayla), liste |
| İşlem kaydı | `/yonetim/kayit` | Kim, ne zaman, neyi değiştirdi (salt okunur) |

### Ortak davranışlar (G, Y82'de bir kez yapar, sonra her ekran kullanır)

- **Liste:** tablo, sayfalama (20'şer), arama kutusu, süzgeç çipleri; süzgeç ve sayfa adreste durur (`?durum=CONFIRMED&sayfa=2`), paylaşılabilir. Yükleniyor iskeleti, boş durum ("Henüz teklif talebi yok"), hata durumu.
- **İki dilli alan:** her metin alanı TR ve EN sekmeli tek bileşen; ikisi de zorunlu. Liste alanları (ör. 3 madde) satır ekle/sil/yukarı/aşağı.
- **Kaydet:** sunucu eylemi API'ye gider; alan hataları alanın yanında (API'nin `fieldErrors` kodları çeviri dosyasından), başarıda kısa bildirim. Kaydetmeden sayfadan çıkılırsa uyarı.
- **Aynı kaydı iki kişi düzenlerse:** form kaydın `updatedAt` değerini geri gönderir; arada başkası kaydettiyse API `409 STALE_WRITE` döner, ekran "Bu kayıt siz düzenlerken değişti, sayfayı yenileyin" der ve girilenleri kaybetmez.
- **Geri alınamayan işlem** (rezervasyon iptali, hesabı devre dışı bırakma, silme): onay penceresi, işlemin adı düğmede ("Rezervasyonu iptal et"), varsayılan odak "Vazgeç"te.
- **Erişilebilirlik:** sitenin geri kalanı gibi WCAG 2.2 AA; tablo başlıkları `<th scope>`, sıralama düğmesinde `aria-sort`, bildirimler `aria-live`.
- **Metinler:** `messages/tr/admin.json` ve `messages/en/admin.json` (CLAUDE.md kuralı). Panel iki dilde çalışır.

## 4. API

Tüm uçlar `/admin` önekiyle, `AdminGuard` (oturum + `role = ADMIN`) arkasında. Mevcut kurallar geçerli (ADR-17: hata biçimi, iki dilli alanlar, tutarlar alt birimde, zamanlar UTC). Farklar ADR-24'te:

- **Sayfalama var:** `?page=1&pageSize=20` (en çok 100), cevap `{ items, total, page, pageSize }`. Sıralama `?sort=createdAt:desc`.
- **Yeni hata kodları:** `FORBIDDEN` (403), `STALE_WRITE` (409), `IN_USE` (409, ör. teklif bağlı ürün silinemez), `INVALID_TRANSITION` (409, ör. iptal edilmiş rezervasyon yeniden iptal edilemez).
- **Değiştiren her istek** (`POST`, `PATCH`, `DELETE`) işlem kaydına bir satır yazar (§5).
- **Hız sınırı:** yönetici başına dakikada 120 istek (kazara döngüye karşı).

| Alan | Uçlar | Notlar |
|---|---|---|
| Özet | `GET /admin/summary` | Sayılar (§3 Özet) |
| Ürünler | `GET/POST /admin/products`, `GET/PATCH/DELETE /admin/products/{slug}`, `POST /admin/products/order` | `slug` oluşturulduktan sonra değişmez (adresler bozulmasın). Teklif talebi bağlı ürün silinmez (`IN_USE`), yayından kaldırılır |
| Hizmetler | `GET/POST /admin/services`, `GET/PATCH/DELETE /admin/services/{slug}`, `POST /admin/services/order` | Hangi ürünlere dahil olduğu hizmetin üzerinde (`productSlugs`) |
| Rezervasyonlar | `GET /admin/reservations`, `GET /admin/reservations/{number}`, `POST /admin/reservations/{number}/cancel` | İptal kullanıcı iptaliyle aynı kural (puan iadesi, bekleyen puan düşer); neden zorunlu, işlem kaydına girer |
| Teklifler | `GET /admin/quotes`, `GET/PATCH /admin/quotes/{number}` | `status` ve `internalNote`. Geçişler: RECEIVED → IN_REVIEW → OFFERED → CLOSED (yeni değer); geri gidiş yok |
| Mesajlar | `GET /admin/contact-messages`, `GET/PATCH /admin/contact-messages/{id}` | `handled: true/false` |
| Kampanya kodları | `GET/POST /admin/promo-codes`, `PATCH/DELETE /admin/promo-codes/{code}` | Kod büyük harf, 3–20 karakter (`normalizePromoCode`), yüzde 1–90. Bir rezervasyonda kullanılmış kod silinmez, pasifleştirilir (`IN_USE`) |
| SSS | `GET/POST /admin/faq`, `PATCH/DELETE /admin/faq/{id}`, `POST /admin/faq/order` | |
| Kiralık filo | `GET/PATCH /admin/vehicle-models/{slug}`, `GET/PATCH /admin/branches/{id}`, `GET/POST /admin/vehicles`, `PATCH /admin/vehicles/{id}`, `GET/PATCH /admin/extras/{slug}` | v1'de yeni model, bayi ve ek hizmet **eklenmez** (seed'le gelir); yalnızca düzenlenir. Araç eklenir ve pasifleştirilir; geleceğe rezervasyonu olan araç pasifleştirilemez (`IN_USE`) |
| Kullanıcılar | `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users/{id}/disable`, `POST /admin/users/{id}/enable` | Bkz. aşağıda |
| Kurumsal müşteriler ve Filom verisi | `/admin/companies/*`, `/admin/contracts/*`, `/admin/fleet-vehicles/*`, `/admin/invoices/*`, `/admin/fleet-expenses/*` | Tam liste FLEET.md §4 |
| İşlem kaydı | `GET /admin/audit-log` | Süzgeç: yönetici, alan, tarih |

**Kurumsal hesap açma** (SPEC §2.9 ve §10'daki "kurumsal hesap nasıl açılır" kararını kapatır): yönetici önce şirketi açar (ad, vergi dairesi, şehir, telefon, satış temsilcisi), sonra şirketin sayfasından kullanıcı davet eder (e-posta, ad, soyad, ünvan; `POST /admin/companies/{id}/users`). API **parolasız** bir `CORPORATE` hesap açar, şirkete bağlar (Google ile giriş PR'ından beri `passwordHash` boş olabilir) ve kişiye şifre belirleme bağlantısı gönderir (mevcut şifre sıfırlama akışı, 7 gün geçerli ayrı bir metinle). Aynı e-posta varsa `409 EMAIL_TAKEN`; bireysel hesabı kurumsala çevirmek v1'de yok.

**Devre dışı bırakma:** `User.disabledAt` dolar, tüm oturumları kapanır, giriş ve Google girişi `401 INVALID_CREDENTIALS` ile reddedilir (hesabın durumu sızmaz). Rezervasyonları ve puanları durur. Yönetici kendini devre dışı bırakamaz.

**Herkese açık uçlarda değişen:** `GET /products`, `/products/{slug}`, `/services` yalnızca yayındaki kayıtları döner ve web'in bugün çeviri dosyasından okuduğu tüm alanları taşır (§6). `GET /me` yanıtına `role` eklenir.

## 5. Veri modeli değişiklikleri

Her biri ait olduğu işin migration'ında gelir (ROADMAP'teki iş numarasıyla):

| Model | Değişiklik | İş |
|---|---|---|
| `User` | `role Role @default(CUSTOMER)`, `disabledAt DateTime?`, `companyId String?` | Y81, Y92 |
| `Company` ve Filom tabloları | FLEET.md §5 | Y92, Y94, Y97 |
| `AdminAuditLog` (yeni) | `id, at, actorId, companyId?` (Filom'dan gelen müşteri işleminde dolu), `action` (ör. `product.update`), `entity`, `entityId`, `summary Json` (değişen alan adları; parola, belirteç ve kişisel veri **değerleri** yazılmaz) | Y81 |
| `Product` | `badge`, `tagline`, `idealFor` (iki dilli metin), `highlights` (3 × başlık+metin), `techPoints` (başlık isteğe bağlı + metin), `tone` (`OLIVE/STONE/AEGEAN/LEAF`), `published`, `updatedAt` | Y83 |
| `Service` | `steps` (3 adım), `icon` (izinli liste: `truck, headset, key, wrench, siren`), `plans` (`INDIVIDUAL/CORPORATE/VIP` listesi), `published`, `updatedAt`; ürünle çoka-çok `ProductService` | Y83 |
| `QuoteRequest` | `internalNote String?`, `updatedAt`; `QuoteStatus`'a `CLOSED` | Y86 |
| `ContactMessage` | `handledAt DateTime?`, `handledById String?` | Y86 |
| `PromoCode`, `FaqItem`, `VehicleModel`, `Branch`, `Vehicle`, `Extra` | `updatedAt` (çakışma denetimi için) | Y88, Y89 |

Seed bu alanları web'in bugünkü çeviri dosyalarından (TR ve EN) doldurur; böylece Y84'te sayfalar API'ye geçtiğinde ekranda hiçbir metin değişmez.

## 6. Ürün ve hizmet sayfalarının API'ye geçişi (Y5)

Bugün `apps/web/lib/products.ts`, `lib/services-data.ts` ve `messages/*/products.json`, `services.json` içindeki **öğe** metinleri sabit. Geçişte:

1. Y83 (BE) alanları ekler ve seed'i çeviri dosyalarından doldurur.
2. Y84 (FE) sayfaları, navbar'daki Ürünler menüsünü, sitemap'i, `llms.txt`'i, JSON-LD'yi ve kurumsal teklif sayfasındaki ürün şeridini API'den okutur; çeviri dosyalarından öğe metinlerini siler (sayfa iskeleti metinleri kalır). `services-data.ts`'teki paket ve ürün tablosu verisi de API'den gelir; ikonlar izinli listedeki adla eşlenir.
3. Önbellek: web bu uçları `next: { tags: ['products'] }` / `['services']` ile 10 dakika saklar. Yönetim panelinde kayıt yapan sunucu eylemi `revalidateTag` çağırır, değişiklik hemen sitede görünür.
4. API kapalıysa sayfa hata durumunu gösterir (CLAUDE.md: her veri sayfasının yükleniyor, boş ve hata durumu); eski metin yedek olarak tutulmaz.

## 7. Güvenlik

- Yetki **API'de** denetlenir; web'deki rol kontrolü yalnızca kullanıcı deneyimidir. Her `/admin` ucu için "oturumsuz 401, müşteri 403" testi zorunludur.
- İşlem kaydı silinemez ve panelden düzenlenemez. Kişisel veri değeri yazmaz, yalnızca hangi alanın değiştiğini yazar.
- Yönetici oturumu 12 saat; Google ile giriş kapalı; parola en az 12 karakter.
- Paneldeki listeler kişisel veri gösterir (ad, e-posta, telefon). KVKK açısından erişim işlem kaydında değil (okuma kaydı tutulmaz, v1), yalnızca yetkili rolle sınırlıdır. SECURITY.md'ye eklenir.
- CSRF: mevcut düzen (SameSite=Lax çerez, istekler web sunucusundan, JSON gövde). Ayrıca `/admin` değiştiren uçlar `Content-Type: application/json` dışındaki istekleri `415` ile reddeder.
- Görsel yolu alanı yalnızca `/images/` ile başlayan site içi yolları ya da `next.config.ts`'te izinli alan adlarını kabul eder.

## 8. Sonraya bırakılanlar

İki adımlı doğrulama (TOTP), ikinci rol (`EDITOR`: yalnızca içerik), görsel yükleme (nesne depolama), okuma kaydı, CSV içe/dışa aktarma (ör. HGS listesi yükleme), kampanya galerisinin panelden yönetimi, yeni model ve bayi ekleme.

## 9. Test

- **BE:** her uç için birim (servis) ve HTTP testleri (yetki: 401/403/200; doğrulama: 422; çakışma: 409 `STALE_WRITE`); veritabanlı entegrasyon testi rezervasyon iptali, kurumsal hesap açma ve kampanya kodu silme yasağı için.
- **FE:** `USE_MOCKS=1` ile yönetim akışlarının e2e testi (giriş → ürün düzenle → sitede görünür; rezervasyon iptali; yetkisiz kullanıcı 404). Mock'lar sözleşmeden üretilen tiplere bağlı.
- **Canlı:** her faz bitince bir kez elle: yönetici girişi, bir kaydı değiştirip sitede görmek.
