# Novera Mobility: İş listesi (BACKLOG v2)

> Durum: **v2.0** · 22 Ekim 2026 · Sahip: G (PM). Tüm işleri Berkay yapar (full stack, Claude Code ile).
> v1'in iş listesi (#1–#40, Y1–Y108) [archive/v1/BACKLOG.md](archive/v1/BACKLOG.md) içinde. v2 işleri `V2-01`'den başlar.
> Her satırın tam issue metni `docs/issues/V2-xx-*.md` dosyasındadır: amaç, kapsam, teknik notlar, kabul kriterleri, testler. Kapsam [SPEC.md](SPEC.md), sıra ve gerekçe [ROADMAP.md](ROADMAP.md), süreç [WORKFLOW.md](WORKFLOW.md).

**Kurallar**
- Bir iş = bir issue = bir dal = bir PR. Dal güncel `main`'den açılır. Zincir PR yok.
- Her iş **dikey bir dilimdir**: API, veritabanı, ekran, metin ve test aynı PR'da. Ayrı "backend PR'ı" ve "frontend PR'ı" yoktur.
- **"Bağımlı"** kesin kısıttır: bağımlı olunan iş `main`'de değilse başlanmaz.
- **Sıra** satır sırasıdır. Değişecekse G karar verir.
- **Öncelik:** P0 acil güvenlik · P1 temel · P2 özellik · P3 iyileştirme.
- **Boyut:** S (bir oturum) · M (birkaç oturum) · L (bir hafta civarı). Süre tahmini değildir, sıralama içindir.
- **Issue numarası:** GitHub'ın verdiği numaradır. G issue'yu açınca aşağıdaki eşleme tablosuna yazar; commit ve PR'da `Closes #<GitHub numarası>` kullanılır, `V2-xx` başlıkta durur.

---

## Faz 0 · Süreç

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-01 | v2 belge seti, issue metinleri, şablonlar, CLAUDE.md | P0 | S | — | G onayıyla `main`'de; etiketler, milestone'lar ve issue'lar açıldı, eşleme tablosu dolu |

## Faz 1 · Acil güvenlik

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-02 | Geçmiş tarihli rezervasyon ve tutmayı engelle; puan kazanımını düzelt; canlıdaki kötü kayıtları bul (G-01) | P0 | S | V2-01 | Geçmiş tarihli istek `422 IN_PAST`; regresyon testleri; canlı sorgu sonucu PR'da |
| V2-03 | Rezervasyon oluşturmaya hız sınırı ve kişi başı gelecek rezervasyon tavanı; tutma sahipliği (G-02, G-16) | P0 | S | V2-02 | Tavan aşılınca `422 RESERVATION_LIMIT`; başkasının tutmasıyla rezervasyon `409` |
| V2-04 | API production'da fail-closed: anahtar, `NODE_ENV`, günlükte kişisel veri yok (G-03, G-07) | P0 | S | V2-01 | Anahtarsız ya da kısa anahtarla açılmıyor; `NODE_ENV` yokken güvenli varsayılan |
| V2-05 | Kampanya kodu güvenliği: deneme sınırı, toplam ve kişi başı tavan; seed canlıda koda ve kura dokunmaz (G-04, G-05) | P0 | M | V2-03 | Kod denemesi 10/10 dk; tavan eşzamanlı istekte aşılmıyor; seed tekrarında kod ve kur değişmiyor |
| V2-06 | Web: tek `mode.ts`, production'da mock yasağı, `.env.example`, `/api` yönlendirmesinin kaldırılması, `carPhotos` gitignore (G-06, G-08, G-19, M-06) | P0 | M | V2-01 | `USE_MOCKS=1` ile production build hata veriyor; `USE_MOCKS` yalnızca `mode.ts`'te okunuyor |

## Faz 2 · Temel sağlamlaştırma

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-07 | API doğrulaması zod ile tek yöntem (ADR-26) (G-09) | P1 | L | Faz 1 | Her uç şemalı; class-validator yok; HTTP testleri aynı hata kodlarını veriyor |
| V2-08 | Web server action'larında zod doğrulaması; hata sınıfları (G-10, M-10) | P1 | M | V2-06 | Sahte girdi 500 değil alan hatası; kurallar tek şemada |
| V2-09 | Hız sınırı v2: Postgres deposu, global varsayılan, kullanıcı anahtarı (ADR-27) (G-11) | P1 | M | V2-07 | Her uç QUALITY §3.2 hedefinde; yeniden başlamada sayaç kalıyor; `429` + `Retry-After` |
| V2-10 | Oturum ve parola: scrypt 2^17 + yeniden özet, boşta kalma, temizlik görevi, hesap silmede doğrulama, giriş kilidinin yumuşatılması (G-12–G-15, V-06) | P1 | M | V2-09 | SECURITY.md "Karar bekleyenler" 1 ve 2 kapandı; testler |
| V2-11 | Veritabanı bütünlüğü: FK, CHECK, indeks, `updatedAt`, rezervasyon numarası, migration kayması ve CI kontrolü (V-01–V-05, V-08, G-17) | P1 | L | V2-07 | `prisma migrate diff` CI'da temiz; kısıt ihlali testleri |
| V2-12 | KVKK saklama süresi ve hesap silmede anonimleştirme (V-07) | P1 | M | V2-11, karar (SPEC §7) | Süresi dolan kayıtlar görevle anonimleşiyor; silinen hesabın teklifinde kişisel veri yok |
| V2-13 | API clean code: `common/`, kopyalar, tipli yapılandırma, iskelet artıkları, kur düzeltmesi (M-01–M-04, V-10) | P1 | L | V2-07 | Kopya yardımcı yok; `any` yok; testler yeşil, davranış aynı |
| V2-14 | Web clean code: API altyapısı tek, kopyalar, token lint kuralı hata seviyesinde, navbar'da framer-motion yerine CSS, bağımlılık sürümleri (M-05, M-07–M-09, P-02) | P1 | L | V2-08 | Lint kuralı rastgele değeri hata sayıyor; ekranlar görsel olarak aynı (önce/sonra) |
| V2-15 | Sayfa başına çeviri yükü (P-01) | P1 | M | V2-14 | İstemciye giden metin yalnızca gereken namespace'ler; önce/sonra boyut PR'da |
| V2-16 | Bilgi mimarisi ve küçük UX hataları: Kurumsal teklif menüde, KVKK/gizlilik ayrımı, rezervasyon kartı fotoğrafı, manifest ikonları (U-01–U-04, U-06) | P1 | S | V2-14 | Menü ve footer'da bağlantı; kartlarda fotoğraf; manifest 192/512/maskable |
| V2-17 | API'deki kullanılmayan ürün/hizmet içerik kopyasının silinmesi (ADR-32) (V-09) | P1 | M | V2-11 | `/products*`, `/services` ve `Service` tablosu yok; teklif ürün referansı çalışıyor |
| V2-18 | CI güvenliği: `pnpm audit`, Dependabot, gizli anahtar taraması (G-18, T-04) | P1 | S | V2-01 | Yüksek bulguda CI kırmızı; bot PR'ları açılıyor |
| V2-19 | Test boşlukları: gerçek API'ye karşı e2e smoke, e2e'de axe, eksik API testleri (T-01–T-03) | P1 | L | V2-11 | CI'da API + DB ile smoke yeşil; axe ihlalinde kırmızı |
| V2-20 | UI/UX, responsive ve erişilebilirlik turu; ekran okuyucu (U-05) | P1 | M | V2-15, V2-16 | Her sayfa tur listesinde; bulunanlar düzeltildi ya da QUALITY'de kayıtlı |
| V2-21 | Performans: production Lighthouse, LCP, fotoğraflar (P-03, P-04) | P1 | M | V2-15 | SPEC §5 hedefleri; rapor PR'da |
| V2-22 | Son güvenlik turu ve SECURITY.md v2 (Faz 2 kapısı) | P0 | M | V2-02–V2-21 | QUALITY'de Kritik/Yüksek açık yok; ASVS listesi işaretli |

## Faz 3 · Yönetim paneli temeli

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-23 | Rol ve yetki: `role`, `AdminGuard`, `admin:create`, 12 saatlik oturum, işlem kaydı | P2 | M | V2-22 | Müşteri 403, oturumsuz 401; komutla yönetici açıldı; kayıt yazılıyor |
| V2-24 | Panel kabuğu ve ortak bileşenler | P2 | L | V2-23 | Yönetici girer, müşteri 404; bileşenler klavyeyle kullanılabilir; axe temiz |
| V2-25 | Özet ekranı ve `GET /admin/summary` | P2 | S | V2-24 | Sayılar gerçek veriden; kartlar süzgeçli listelere gider |

## Faz 4 · Katalog

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-26 | Kampanya kodları yönetimi | P2 | M | V2-24, V2-05 | Panelde açılan kod özet sayfasında çalışıyor; kullanılmış kod silinmiyor |
| V2-27 | Bayi yönetimi: ekle, düzenle, kapat, yeniden aç | P2 | L | V2-24 | Yeni bayi sitede görünüyor; kapatma kuralları; kapanan bayi sitede yok |
| V2-28 | Fotoğraf yükleme altyapısı (ADR-28) | P2 | M | V2-24, karar (SPEC §7) | Tür/boyut denetimi; EXIF temiz; CSP ve görsel ayarları güncel |
| V2-29 | Araç modeli yönetimi: ekle (fotoğraflı), düzenle, kaldır | P2 | L | V2-28 | Yeni model filo bölümünde ve aramada; kaldırma kuralları; fiyat değişikliği eski rezervasyonu etkilemiyor |
| V2-30 | Araç yönetimi (ekle, taşı, kaldır) ve ek hizmetler | P2 | M | V2-27, V2-29 | Yeni araç aramada müsait; gelecek rezervasyonlu araç kaldırılamıyor |

## Faz 5 · Operasyon

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-31 | Rezervasyonlar: liste, arama, detay, iptal | P2 | M | V2-24 | Panel iptali kullanıcı iptaliyle aynı puan sonucu; nedeni kayıtta |
| V2-32 | Teklif talepleri ve iletişim mesajları | P2 | M | V2-24 | Durum akışı; geçersiz geçiş `409`; iç not müşteriye görünmüyor |

## Faz 6 · Şirketler ve hesaplar

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-33 | `Company` modeli, Şirketler ekranı, kurumsal kullanıcı daveti | P2 | L | V2-24 | Davetli şifre belirleyip kurumsal sekmeden giriyor; mevcut kurumsal hesaplar aynı |
| V2-34 | Kullanıcılar (arama, kapatma) ve İşlem kaydı ekranı | P2 | M | V2-33 | Kapatılan hesap giremiyor; kayıt süzülebiliyor |

## Faz 7 · Filom temeli

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-35 | Filom verisi, `CompanyGuard`, panelde sözleşme / filo aracı / okuma girişi, örnek şirket seed'i | P2 | L | V2-33 | Başka şirketin kaydı 404; panelden araç ve okuma girildi |
| V2-36 | Filom kabuğu: Özet, Araçlar, Personel, Zimmet, Sözleşmeler; KVKK bölümü | P2 | L | V2-35 | Kurumsal giriş → araç ver → detayda zimmet; bireysel 404 |

## Faz 8 · Filom maliyetleri

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-37 | Faturalar: panelde oluşturma ve ödendi; Filom'da liste, detay, yazdırma | P2 | M | V2-36 | Aynı dönem ikinci kez `409`; "örnek fatura" notu |
| V2-38 | Masraflar: panelde giriş; Filom'da personele eşleme, yansıtma, itiraz; sözleşme yenileme talebi | P2 | L | V2-37 | Zimmet sınırında doğru eşleme; yenileme talebi panelde Teklifler'de |

## Faz 9 · Raporlar ve Yeşil Filo

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-39 | Filom raporları: maliyet ve kilometre, grafik + tablo | P2 | M | V2-38 | Toplamlar fatura ve masrafla kuruşu kuruşuna tutuyor |
| V2-40 | Yeşil Filo: karbon, batarya sağlığı, şarj seviyesi, yakın şarj istasyonları (simülasyon) | P2 | M | V2-39 | Elektrikli araçta istasyon listesi; "Simülasyon" rozeti; harita yoksa liste |

## Faz 10 · Talepler

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-41 | Servis talepleri: yol yardım, ikame araç, bakım/lastik (Filom + panel) | P2 | L | V2-36 | Talep açılıyor, panelde ilerliyor, Filom'da zaman çizelgesi; geçersiz geçiş `409` |
| V2-42 | VIP transfer talebi | P2 | M | V2-41 | Yalnızca VIP sözleşmeli şirkette; uçuş ve karşılama bilgisi; panelde şoför atanıyor |

## Faz 11 · Canlı takip

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-43 | Canlı takip simülasyonu: harita, liste, 24 saatlik rota | P2 | L | V2-36 | Deterministik konum; 30 sn yenileme; rozet; harita yoksa liste |

## Faz 12 · Yayın ve kabul

| # | İş | Öncelik | Boyut | Bağımlı | Kabul özeti |
|---|---|---|---|---|---|
| V2-44 | E-postalar: rezervasyon onayı ve iptali, seyahat hatırlatma, talep durumu (TR/EN) | P2 | M | V2-31, V2-41 | Kendi adrese e-postalar geldi; tercihi kapalı kullanıcıya hatırlatma yok |
| V2-45 | Canlı ortam tamamlama: site adresi, analytics, Maps kısıtı, Blob anahtarı, ilk yönetici, yedek ve geri yükleme denemesi | P1 | S | V2-28, V2-23 | DEPLOY.md ve SECURITY.md kontrol listeleri işaretli |
| V2-46 | Son kabul: SPEC §6 akışları canlıda, QUALITY kapanışı, belgeler güncel, `v2.0.0` | P0 | S | Hepsi | Kontrol listesi issue yorumunda işaretli; etiket atıldı |

---

## GitHub issue eşlemesi

Açıldı: 22 Ekim 2026, scripts/create-issues.ps1 ile. Eski FE/BE ayrımlı Y81–Y108 issue'ları (#262–#289) "not planned" olarak kapatıldı; her birinin yorumunda yerine geçen V2 işi yazılı.

| V2 | GitHub # |
|---|---|
| V2-01 | #291 |
| V2-02 | #292 |
| V2-03 | #293 |
| V2-04 | #294 |
| V2-05 | #295 |
| V2-06 | #296 |
| V2-07 | #297 |
| V2-08 | #298 |
| V2-09 | #299 |
| V2-10 | #300 |
| V2-11 | #301 |
| V2-12 | #302 |
| V2-13 | #303 |
| V2-14 | #304 |
| V2-15 | #305 |
| V2-16 | #306 |
| V2-17 | #307 |
| V2-18 | #308 |
| V2-19 | #309 |
| V2-20 | #310 |
| V2-21 | #311 |
| V2-22 | #312 |
| V2-23 | #313 |
| V2-24 | #314 |
| V2-25 | #315 |
| V2-26 | #316 |
| V2-27 | #317 |
| V2-28 | #318 |
| V2-29 | #319 |
| V2-30 | #320 |
| V2-31 | #321 |
| V2-32 | #322 |
| V2-33 | #323 |
| V2-34 | #324 |
| V2-35 | #325 |
| V2-36 | #326 |
| V2-37 | #327 |
| V2-38 | #328 |
| V2-39 | #329 |
| V2-40 | #330 |
| V2-41 | #331 |
| V2-42 | #332 |
| V2-43 | #333 |
| V2-44 | #334 |
| V2-45 | #335 |
| V2-46 | #336 |
