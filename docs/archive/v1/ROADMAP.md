> **Arşiv (v1, 22 Ekim 2026'da taşındı).** Bu belge artık güncellenmez; yalnızca referanstır. Güncel belgeler için [docs/README.md](../../README.md). Göreli bağlantılar taşınmadan önceki konuma göre yazılmıştır.

# Yol haritası: v1'e kalan işler

> 20 Ekim 2026 · BACKLOG M8, M9 ve M10'un açıklaması. Sahipler: **BE = Berkay**, **FE = G**, **İKİ = birlikte**.
> İki panelin tasarımı: [ADMIN.md](ADMIN.md) (Yönetim paneli, Novera çalışanı) ve [FLEET.md](FLEET.md) (Filom, kurumsal müşteri). Kapsam kararı SPEC §2.11 ve §2.12'de (v0.11), mimari kararlar ARCHITECTURE ADR-24 ve ADR-25'te.
> Bu belge sıra ve görev dağılımıdır. Kapsam SPEC'e, iş tanımı BACKLOG'a aittir; çelişki olursa onlar kazanır.

## 1. Neredeyiz

Canlıda (Vercel + Render + Neon) çalışan: kiralama akışı uçtan uca (arama, 15 dakika tutma, özet, kampanya kodu, puanla ödeme, sahte ödeme, onay), hesap (kayıt, giriş, şifre sıfırlama, ayarlar, oturumlar, Rezervasyonlarım, Puanlarım, iptal), kurumsal teklif ve iletişim formları, SSS ve Yardım. Google ile giriş backend'de hazır (#258), ön yüzü G'de.

Kalan işler dört grupta:

1. **Yönetim paneli:** içerik ve operasyon bugün koddan ya da veritabanından elle yönetiliyor. Kurumsal hesap açmanın da bir yolu yok (SPEC §10).
2. **Ürünler ve hizmetler:** sayfalar hâlâ çeviri dosyasındaki sabit metni okuyor (BACKLOG Y5). Panel olmadan API'ye taşınırsa metni yine biri veritabanında elle düzeltmek zorunda kalır; bu yüzden panelle aynı fazda (Faz 2).
3. **Filom:** ürün sayfasında satılan filo paneli (zimmet, sözleşme, fatura, HGS ve ceza, raporlar). Verisini Novera Yönetim panelinden girdiği için Yönetim panelinin üstüne kurulur (Faz 5–8).
4. **Yayın tamamlama:** e-postalar, SECURITY.md'deki açık kararlar, fotoğraflar, Lighthouse ve ekran okuyucu turu, analytics, Maps anahtarı, yedek (Faz 9).

## 2. Çalışma kuralları

- Bir iş = bir issue = bir dal = bir PR. Dal **güncel `main`'den** açılır, PR **`main`'e** açılır. Üst üste (zincir) PR yok.
- PR gövdesinde `Closes #<issue>`. Kısmi işte `Refs #<issue>`.
- BE PR'ı sözleşmeyi (`docs/api/openapi.yaml`) aynı PR'da günceller. G birleşince `pnpm --filter @novera/web gen:api` çalıştırır.
- BE PR'ını G, FE PR'ını Berkay inceler. CI yeşil olmadan birleşmez.
- Backend işi `apps/web`'e, frontend işi `apps/api`'ye dokunmaz (CLAUDE.md). **İstisna:** Y95 ve Y98 Yönetim panelinin iki veri giriş ekranıdır ve Berkay'a verildi (iş yükü dengesi, §5); issue'larında bu yazılıdır, G inceler ve Y82'nin ortak bileşenlerini kullanır, yeni bileşen yazılmaz.
- Her fazda **önce BE**, sonra o fazın FE işi. BE işi birleşince G ekranlara geçer; o sırada Berkay bir sonraki fazın BE işine başlar (§5).
- G uç birleşmeden başlamak isterse `USE_MOCKS=1` ile çalışabilir; mock sözleşmedeki biçime uyar.

## 3. Fazlar ve işler

Boyut: **S** küçük (bir oturum), **M** orta (birkaç oturum), **L** büyük (bir haftalık iş). Kesin süre değil, sıralama içindir.

### Faz 0 · Hazırlık

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y79 | Belgeler: SPEC v0.11 (iki panel kapsama girer), ADR-24, ADR-25, ADMIN.md, FLEET.md, ROADMAP.md, BACKLOG M8–M10, STATUS.md yönlendirmesi | İKİ | S | — | G onayıyla `main`'de |
| Y80 | Google ile giriş ön yüzü: bireysel sekmede düğme, CSP, `signInWithGoogle`, onay kutusu akışı, hata metinleri, "şifre belirle" (`hasPassword: false`), TR/EN, e2e | FE | M | #258 | Canlıda yeni hesap (201), mevcut hesap (200) ve kurumsal ret (403) denendi; e2e mock'la yeşil |

### Faz 1 · Yönetim paneli temeli

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y81 | Rol ve yetki: `User.role`, `AdminGuard`, yönetici oturumu 12 saat, yöneticiye Google girişi kapalı, `AdminAuditLog` ve kayıt yazıcısı, `pnpm admin:create` komutu, `GET /me`'de `role`, `GET /admin/summary`, `GET /admin/audit-log`; sözleşme ve ADR-24 hata kodları | BE | M | Y79 | Müşteri `403`, oturumsuz `401`, yönetici `200` testleri; komut Neon'da bir yönetici açtı; SECURITY.md güncel |
| Y82 | Yönetim kabuğu: `/yonetim` (EN `/en/admin`) düzeni, sunucuda rol kontrolü (yetkisize 404), yan menü, Özet ekranı ve **iki panelin de kullanacağı ortak bileşenler**: tablo + sayfalama + arama, süzgeç adreste, TR/EN sekmeli metin alanı, onay penceresi, bildirim, `STALE_WRITE` uyarısı; `messages/*/admin.json`, noindex | FE | L | Y81 | Yönetici panele girer, müşteri 404 görür (e2e); Özet sayıları gerçek API'den; 375/768/1280 taşma yok; axe temiz |

### Faz 2 · Ürünler ve hizmetler

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y83 | İçerik modeli: `Product` ve `Service` yeni alanları, `ProductService`, `published`; seed web'in çeviri dosyalarından (TR+EN); herkese açık uçlar yeni alanlarla ve yalnızca yayındakiler; `/admin/products`, `/admin/services` (liste, oku, oluştur, güncelle, sırala, sil; slug değişmez; `STALE_WRITE`; teklif bağlıysa `IN_USE`) | BE | L | Y81 | Seed sonrası API'nin döndürdüğü metinler çeviri dosyalarıyla birebir aynı (test); yetki ve çakışma testleri |
| Y84 | Ürünler ve Hizmetler sayfaları API'den (**BACKLOG Y5**): liste ve detay, navbar Ürünler menüsü, hizmet kartları, paket etiketleri, ürün tablosu, kurumsal teklif ürün şeridi, sitemap, `llms.txt`, JSON-LD; `lib/products.ts`, `services-data.ts` ve öğe metinleri kalkar; önbellek etiketi | FE | M | Y83 | Sayfalar ekranda değişmeden API'den geliyor (ekran görüntüsü önce/sonra); API kapalıyken hata durumu; e2e yeşil |
| Y85 | Yönetim > Ürünler ve Hizmetler: liste, sıra, düzenleme formu (TR/EN, maddeler), yayınla/kaldır, yeni kayıt, kaydedince `revalidateTag` | FE | L | Y82, Y83 | Panelde değiştirilen başlık sitede hemen görünüyor (e2e mock + canlıda bir kez elle) |

### Faz 3 · Operasyon

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y86 | `/admin/reservations` (liste, arama, süzgeç, detay, iptal + neden), `/admin/quotes` (liste, durum geçişleri, iç not; `CLOSED`), `/admin/contact-messages` (liste, ele alındı); migration | BE | L | Y81 | Panelden iptal kullanıcı iptaliyle aynı puan sonucunu veriyor (entegrasyon testi); geçersiz geçiş `INVALID_TRANSITION` |
| Y87 | Yönetim > Rezervasyonlar, Teklif talepleri, Mesajlar ekranları | FE | L | Y82, Y86 | Üç ekran e2e; iptal onay penceresiyle; süzgeç adreste |

### Faz 4 · Katalog

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y88 | `/admin/promo-codes` (kullanılmış kod silinmez), `/admin/faq` (sıra dahil) | BE | M | Y81 | Panelden eklenen kod özet sayfasında çalışıyor (test); kullanılmış kodu silmek `IN_USE` |
| Y89 | Kiralık filo: `/admin/vehicle-models` (fiyat, açıklama, görsel yolu), `/admin/branches` (bilgi, çalışma saatleri), `/admin/vehicles` (ekle, düzenle, pasifleştir; geleceğe rezervasyonu olan pasifleşmez), `/admin/extras` | BE | M | Y81 | Fiyat değişikliği yeni aramada görünüyor, mevcut rezervasyonun tutarını değiştirmiyor (test) |
| Y90 | Yönetim > Kampanya kodları ve SSS ekranları | FE | M | Y82, Y88 | e2e; SSS sırası ana sayfada ve Yardım'da değişiyor |
| Y91 | Yönetim > Kiralık filo ekranları (modeller, bayiler, araçlar, ek hizmetler) | FE | M | Y82, Y89 | e2e; çalışma saatleri formu klavyeyle kullanılabiliyor |

### Faz 5 · Şirketler ve kullanıcılar

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y92 | `Company` modeli (kurumsal alanlar `User`'dan migration'la taşınır, `GET /me` aynı kalır), `/admin/companies` (oluştur, düzenle, kullanıcı davet et: parolasız hesap + şifre belirleme e-postası; SPEC §10 kararını kapatır), `/admin/users` (liste, arama, detay, devre dışı bırak / aç: `disabledAt`) | BE | M | Y81 | Davet edilen kişi bağlantıyla şifre belirleyip kurumsal sekmeden giriyor; devre dışı hesap giremiyor; mevcut kurumsal hesapların firma bilgisi migration'dan sonra aynı (testler) |
| Y93 | Yönetim > Kurumsal müşteriler (şirket, kullanıcı davet), Kullanıcılar ve İşlem kaydı ekranları | FE | M | Y82, Y92 | e2e: şirket aç, kullanıcı davet et, devre dışı bırakma onayı |

### Faz 6 · Filom temeli

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y94 | Filom verisi ve uçları (FLEET.md §4–5): `CompanyEmployee`, `FleetContract`, `FleetVehicle`, `VehicleAssignment`, `VehicleReading`; `CompanyGuard`; `/fleet/summary`, `vehicles`, `employees`, `assignments`, `contracts`; yönetim tarafında sözleşme, filo aracı ve okuma uçları; iki örnek şirketle seed | BE | L | Y92 | Başka şirketin kaydı 404, bireysel hesap 403 (her uçta test); açık zimmetli araca yeni zimmet `409 VEHICLE_ASSIGNED`; seed iki kez çalışınca kopya yok |
| Y95 | Yönetim > Şirket sözleşmeleri, filo araçları ve okuma girişi ekranları (**istisna: Berkay yapar**, Y82 bileşenleriyle) | FE (Berkay) | M | Y82, Y94 | e2e: sözleşmeye araç ekle, okuma gir; G'nin incelemesi |
| Y96 | Filom kabuğu ve ilk ekranlar: `/filom` (EN `/en/my-fleet`) düzeni, hesap menüsünde ve kurumsal profilde bağlantı, Özet, Araçlar (liste + detay), Personel, Zimmet (ver, geri al, geçmiş), Sözleşmeler; filosu olmayan şirkette boş durum; `messages/*/fleet-panel.json`; KVKK metnine personel bölümü | FE | L | Y82, Y94 | e2e: kurumsal giriş → Özet → araç ver → araç detayında zimmet; bireysel hesap `/filom`'a giremiyor; 375/768/1280; axe temiz |

### Faz 7 · Filom maliyetleri

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y97 | `FleetInvoice` ve `FleetExpense`; aylık fatura oluşturma (`POST /admin/invoices/generate`), ödendi işareti, masraf girişi (HGS, ceza, bakım); masrafın o anki zimmetli personele otomatik eşlenmesi; `/fleet/invoices`, `/fleet/expenses` (durum, toplu yansıtma), sözleşme yenileme talebi; seed'e 3 aylık fatura ve masraf | BE | L | Y94 | Aynı dönem ikinci kez `409 ALREADY_GENERATED`; zimmet değişim anının iki yanındaki masraf doğru kişiye eşleniyor; yenileme talebi Yönetim > Teklifler'de görünüyor (testler) |
| Y98 | Yönetim > Faturalar (dönem seç, oluştur, ödendi) ve Filo masrafları (giriş, liste) ekranları (**istisna: Berkay yapar**) | FE (Berkay) | M | Y95, Y97 | e2e: faturaları oluştur, bir masraf gir; G'nin incelemesi |
| Y99 | Filom > Faturalar (liste, detay, yazdırılabilir), Masraflar (süzgeç, personel, personele yansıt, itiraz), Sözleşmede "Yenileme talebi" | FE | L | Y96, Y97 | e2e: masraf personelde görünür, toplu yansıtılır; fatura detayında "örnek fatura" notu |

### Faz 8 · Filom raporları

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y100 | `/fleet/reports`: dönem, araç, departman ve ay kırılımında maliyet ve kilometre; Yeşil Filo için karbon tasarrufu (FLEET.md §3 katsayıları) ve batarya sağlığı; Özet'e bakım/muayene yaklaşanlar | BE | M | Y97 | Rapor toplamları faturalar ve masraflarla kuruşu kuruşuna tutuyor (test) |
| Y101 | Filom > Raporlar: dönem seçimi, tablolar ve sade çubuk grafikler (her grafiğin tablo karşılığı), karbon ve batarya bölümü; ürün sayfasında kurumsal kullanıcıya "Filom'a git" bağlantısı | FE | M | Y96, Y100 | e2e; grafikler klavye ve ekran okuyucuyla tablodan okunabiliyor; axe temiz |

### Faz 9 · Yayın tamamlama

Panellerden bağımsızdır; boşluk oldukça araya girilebilir (§5).

| # | İş | Sahip | Boyut | Bağımlı | Bitti sayılması için |
|---|---|---|---|---|---|
| Y102 | E-postalar: rezervasyon onayı (oluşturulunca), seyahat öncesi hatırlatma (alıştan 24 saat önce, `notifyReminders` açıksa, günlük görev), kurumsal davet metni; Resend, TR/EN şablon | BE | M | Resend alan adı | Kendi adresine e-postalar geldi; tercihi kapalı kullanıcıya hatırlatma gitmiyor (test) |
| Y103 | SECURITY.md açık kararları: hesap silmede doğrulama (parolalı hesapta mevcut parola, parolasızda e-postayı yazarak onay), giriş kilidinin yumuşatılması, açık okuma uçlarına hız sınırı; iki panel için SECURITY.md bölümleri | BE | S | — | SECURITY.md "Karar bekleyenler" 1, 2 ve 5 kapandı |
| Y104 | Hesap silme penceresinde doğrulama alanı (Y103'ün ön yüzü) | FE | S | Y103 | e2e: yanlış parola alan hatası, doğru parola hesabı siler |
| Y105 | Fotoğraflar: eksik 4 model (volkswagen-golf, hyundai-tucson, volkswagen-id4, audi-a6), galeri ve Hikayemiz; WebP/AVIF, `next/image` önceliği; PHOTO-CREDITS.md | FE | M | — | Tüm modellerde fotoğraf; kaynaklar belgede |
| Y106 | Denetim (#47'nin kalanı): production build'de mobil Lighthouse, ekran okuyucu turu (NVDA; iki panel dahil), bulunanların düzeltilmesi; PERFORMANCE.md ve AUDIT.md güncel | FE | M | Y105 | LCP < 2,5 sn, INP < 200 ms, CLS < 0,1 (SPEC §9); rapor PR'da |
| Y107 | Canlı ortam tamamlama: `NEXT_PUBLIC_SITE_URL` ve analytics kararı + kurulumu (G, Vercel); Google Maps anahtarının alan adı kısıtı ve kota, sızan `API_ACCESS_KEY`'in yenilendiğinin doğrulanması, haftalık yedek ve **geri yükleme denemesi** (Berkay) | İKİ | S | — | DEPLOY.md ve SECURITY.md kontrol listeleri işaretli |
| Y108 | Son kabul: SPEC §8 akışları canlıda 375 ve 1280 px'te ve yalnızca klavyeyle; Yönetim paneli ve Filom turu (örnek şirketle); STATUS.md v1; `v1.0.0` etiketi | İKİ | S | Hepsi | Kontrol listesi bir issue yorumunda işaretli |

## 4. Kim ne yapar

**Berkay**, önerilen sıra:
Y79 → Y81 → Y83 → Y86 → Y88 → Y89 → Y92 → Y94 → Y95 → Y97 → Y98 → Y100 → Y103 → Y102 → Y107 → Y108

**G**, önerilen sıra:
Y80 → Y82 → Y84 → Y85 → Y87 → Y90 → Y91 → Y93 → Y96 → Y99 → Y101 → Y104 → Y105 → Y106 → Y107 → Y108

**Berkay'ın hesap ve ayar işleri** (kod değil):
- Y81 birleşince: Neon'da ilk yönetici hesabını `pnpm admin:create` ile açmak.
- Y83, Y94 ve Y97 birleşince: Neon'a `pnpm db:seed` (ürün/hizmet alanları, örnek şirketler, faturalar).
- Y102 öncesi: Resend'de alan adı doğrulaması ya da test adresiyle devam kararı.
- Y107: Google Cloud'da Maps anahtarına alan adı kısıtı, Render/Vercel'de anahtar kontrolü, haftalık `pg_dump`.

**G'nin karar ve içerik işleri:**
- Y79'u incelemek (SPEC kapsam değişikliğine ve Y95/Y98 istisnasına onay).
- KVKK aydınlatma metnine kurumsal müşteri personeli bölümü (FLEET.md §6), Y96 içinde.
- Y105: fotoğrafları seçmek. Y107: analytics aracı kararı (SPEC §10).

## 5. Akış

İş sayısı: Berkay 13 (11 BE + 2 istisna ekran), G 14, ayrıca 3 ortak. Ekran işleri büyük olduğu için iki veri giriş ekranı (Y95, Y98) Berkay'a verildi; G yine de geride kalırsa Berkay Faz 9'un BE işlerini (Y103, Y102) öne alır.

Hangi iş birleşince kim neye başlayabilir:

| `main`'e girer | Başlayabilir |
|---|---|
| Y79 (belgeler) | G: Y80 zaten başlayabilir (PR C birleşti). Berkay: Y81 |
| Y81 | G: Y82 |
| Y83 | G: Y84, sonra Y85 |
| Y86 | G: Y87 |
| Y88 / Y89 | G: Y90 / Y91 |
| Y92 | G: Y93. Berkay: Y94 |
| Y94 | G: Y96. Berkay: Y95 (Y82 de birleşmiş olmalı) |
| Y97 | G: Y99. Berkay: Y98 |
| Y100 | G: Y101 |
| Y103 | G: Y104 |

Y105 ve Y106 hiçbir BE işine bağlı değil; G ekranlar arasında boşluk olursa bunlara geçer. Y108 en sonda, ikiniz birlikte.

## 6. Açık kalan kararlar

| Karar | Kimde | Öneri |
|---|---|---|
| İki panel kapsama girsin mi (SPEC §3 değişikliği) | G | Evet; Y79 PR'ında onay |
| Y95 ve Y98'in Berkay'a verilmesi (CLAUDE.md istisnası) | G | Evet; yalnızca Y82 bileşenleriyle, G inceler |
| Kampanya galerisi panelden yönetilsin mi (SPEC §10) | İKİ | v1'de hayır, sabit kalır |
| E-posta gönderen alan adı | Berkay | Alan adı yoksa Resend test adresi; yalnızca kendi adresine gider (DEPLOY.md §3) |
| Analytics aracı | G | Umami Cloud ücretsiz plan ya da Vercel Web Analytics |
| İki adımlı doğrulama (yönetici), şirket içi roller (Filom) | İKİ | v1 sonrası (ADMIN.md §8, FLEET.md §1) |
