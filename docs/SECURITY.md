# Güvenlik gözden geçirmesi (BACKLOG 39, issue #48)

> **v2 (22 Ekim 2026):** bu belge güvenlik kararlarının kaydı olarak sürer. 22 Ekim keşfinde bulunan açıklar (bir kritik, beş yüksek) [QUALITY.md](QUALITY.md) §1.1'de `G-xx` kimlikleriyle duruyor ve Faz 1–2'de kapanır. Her iş kapandıkça ilgili satır aşağıdaki "v2'de düzeltilenler" tablosuna, hız sınırı değişiklikleri "Hız sınırı tablosu"na yazılır (V2-09'dan sonra tek kaynak burasıdır). Son tur ve bu belgenin v2 sürümü V2-22'dir.
>
> **Düzeltme (22 Ekim):** S9'daki "canlıda anahtar yoksa API açılmaz" ifadesi kodda karşılanmıyor: `assertRuntimeEnv` `API_ACCESS_KEY`'e bakmıyor, anahtar yoksa `apiAccess` her isteği geçiriyor. Bugün yalnızca `render.yaml`'ın anahtarı üretmesi koruyor. QUALITY G-03, düzeltmesi V2-04. **V2-04 ile açılış kontrolü eklendi:** S9'daki ifade artık kodda doğru (aşağıdaki "v2'de düzeltilenler" tablosu).

## v2'de düzeltilenler

| QUALITY # | İş | PR | Not |
|---|---|---|---|
| G-01 | V2-02 ([#292](https://github.com/BerkayToluc/Novera-Mobility/issues/292)) | PR'da | `startAt` şu andan en az 30 dakika sonra ve en çok 365 gün sonra olmalı (`IN_PAST`, `OUT_OF_RANGE`; tutma, fiyat, rezervasyon ve arama uçlarında). Puan bakiyeye yalnızca `createdAt < startAt` olan rezervasyondan geçer |

| G-18 | V2-18 ([#308](https://github.com/BerkayToluc/Novera-Mobility/issues/308)) | PR'da | CI'da `pnpm audit:prod` (yüksek/kritik bulguda kırmızı, dar ve tarihli izin listesi), haftalık Dependabot, CodeQL. İlk çalışmada **gerçek bulgular** çıktı ve düzeltildi: Next.js 16.3.8 → 16.4.3 (iki kritik uzaktan kod çalıştırma, bir yüksek hizmet engelleme), zod 4.6.5 → 4.6.7, `body-parser` 2.3.0 → 2.4.0 (`@nestjs/platform-express` 12.2.0 ile), `multer` 2.4.0 → 2.5.0 (override). Secret scanning ve push protection repo ayarıdır (G); açık olduğu doğrulanmadı |
| G-04, G-05 | V2-05 ([#295](https://github.com/BerkayToluc/Novera-Mobility/issues/295)) | PR'da | Kod içeren `POST /reservations/price` istemci başına 10 dakikada 10 istek; `PromoCode.maxRedemptions` ve `oncePerUser`; kod satırı kilitlenerek (araç ve hesaptan sonra) sayım ve ekleme aynı işlemde; `CODE_EXHAUSTED` / `CODE_ALREADY_USED`; fiyat cevabı kodu ayırt ettirmez; `percent` 1–90 CHECK ile. Seed canlıda var olan kod, kur ve fiyatı ezmez, örnek kodlar `SEED_DEMO=1` ile |
| G-06, G-08, G-19, M-06 | V2-06 ([#296](https://github.com/BerkayToluc/Novera-Mobility/issues/296)) | PR'da | `USE_MOCKS` yalnızca `apps/web/lib/mode.ts`'te okunur. Üretimde (`VERCEL_ENV=production`, ya da `NODE_ENV=production` ve test bayrağı `NOVERA_E2E` yok) `USE_MOCKS` doluysa `next build` ve `next start` hata verip durur; Vercel üretiminde `NOVERA_E2E` de işe yaramaz. Ödeme öncesi giriş zorunluluğu mock modunda da açık. `/api` yönlendirmesi kaldırıldı: API web adresi üzerinden de erişilemez. `carPhotos/` `.gitignore`'da |
| G-03, G-07 | V2-04 ([#294](https://github.com/BerkayToluc/Novera-Mobility/issues/294)) | PR'da | API production'da açılırken `API_ACCESS_KEY` (en az 32 karakter), `DATABASE_URL` ve https `WEB_URL` yoksa hatayla durur (hata değeri yazmaz). "Production mı?" kararı tek yerde (`isProduction`): geliştirme yalnızca açıkça `NODE_ENV=development` (ya da `test`) ile geçerli; `NODE_ENV` yoksa ya da başka bir şeyse, ya da `RENDER` / `K_SERVICE` (Cloud Run) tanımlıysa production sayılır. Oturum çerezi `Secure`, sıfırlama bağlantısı günlüğe yazılmaz, `/docs` kapalı |
| G-02, G-16 | V2-03 ([#293](https://github.com/BerkayToluc/Novera-Mobility/issues/293)) | PR'da | `POST /reservations` kullanıcı başına saatte 10 istek; bir hesapta en çok 3 gelecek ya da devam eden rezervasyon (`422 RESERVATION_LIMIT`, sayım ve ekleme kullanıcı satırı kilidiyle aynı işlemde); `POST /reservations/price` istemci başına 10 dakikada 60 istek; `holdId` yalnızca tutmayı açan istemci anahtarıyla kullanılabilir |

### Hız sınırı tablosu (V2-09; tek kaynak burasıdır)

Her uçta bir sınır vardır (ADR-27). Sayaçlar Postgres'te (`RateLimitHit`) tutulur; API yeniden başlayınca ya da ikinci bir örnek açılınca kaybolmaz. Pencere sabittir: sayaç pencerenin başında sıfırlanır, bu yüzden pencere sınırında en çok iki katı istek geçebilir. Sınırı aşan istek `429 RATE_LIMITED` ve saniye cinsinden `Retry-After` alır. Sınır doğrulamadan önce sayılır: geçersiz istek de sayılır. Eski pencereler her gün silinir.

**Anahtar:** *adres* istemci adresinin özetidir (`ip:<özet>`, adresin kendisi saklanmaz); *hesap* girişli istekte `user:<id>`, girişsiz istekte adrestir; *e-posta* gövdedeki adrestir (`email:<adres>`, küçük harfe çevrilir). Yönetici sınırı (`admin:<id>`, dakikada 120) V2-23'te gelir.

| Uç | Sınır | Anahtar | Kova |
|---|---|---|---|
| `POST /auth/register` | 10 istek/saat | adres | `register` |
| `POST /auth/login` | 10 istek/15 dk; ayrıca e-posta başına 5 yanlıştan sonra artan bekleme (`LoginThrottle`, en çok 15 dk) | adres; e-posta | `login` |
| `POST /auth/google` | 10 istek/15 dk | adres | `google` |
| `POST /auth/forgot-password` | 5 istek/saat ve ayrıca 3 istek/saat | adres; e-posta | `forgot`, `forgot-email` |
| `POST /auth/reset-password` | 10 istek/15 dk | adres | `reset` |
| `POST /me/password` | 5 istek/15 dk | hesap | `change-password` |
| `PATCH /me`, `DELETE /me`, `DELETE /me/sessions`, `DELETE /me/sessions/{id}`, `POST /me/reservations/{id}/cancel` | 20 istek/15 dk | hesap | `account-write` |
| `POST /contact` | 10 istek/saat | adres | `contact` |
| `POST /quotes` | 10 istek/saat | adres | `quotes` |
| `POST /holds` | 30 istek/saat (ayrıca bir istemci en çok 5 etkin tutma açabilir; bu kural serviste) | hesap | `holds` |
| `POST /reservations/price` | 60 istek/10 dk | hesap | `price` |
| `POST /reservations/price` (gövdede `promoCode` varsa, yukarıdakine ek olarak) | 10 istek/10 dk | hesap | `promo` |
| `POST /reservations` | 10 istek/saat (ayrıca bir hesapta en çok 3 gelecek rezervasyon; bu kural serviste) | hesap | `reserve` |
| `GET /health` | sınır yok (barındırıcının sağlık denetimi) | — | — |
| Yukarıda olmayan her uç: katalog okumaları, `/rates`, `/products*`, `/services`, `GET /me*`, `DELETE /holds/{id}`, `GET /me/quotes` | 300 istek/5 dk | hesap | `default` |

### Canlıda G-01 kötüye kullanım tespiti (V2-02)

Salt okunur; kişisel veri döndürmez. Önce yalnızca sayıya bakılır, sonuç issue'ya yazılır.

```sql
-- Başlangıcından sonra oluşturulmuş (geçmiş tarihli) rezervasyonlar ve verdikleri puan.
SELECT COUNT(*)                          AS reservations,
       COUNT(DISTINCT r."userId")        AS users,
       COALESCE(SUM(p.points), 0)        AS points_granted
FROM "Reservation" r
LEFT JOIN "PointTransaction" p ON p."reservationId" = r.id
WHERE r."createdAt" >= r."startAt";
```

Sonuç 0 ise kötüye kullanım yoktur (24 Ekim 2026'da canlıda çalıştırıldı: `0 | 0 | 0`). Sıfırdan büyükse kayıtlara bakmak ve ne yapılacağını (puanı silmek, hesabı kapatmak) G'nin kararına bırakmak gerekir; V2-02 bu kayıtları artık puan saymaz ama silmez.

## v2 açık bulgular (özet)

Tam liste, seviye ve dosya:satır [QUALITY.md](QUALITY.md) §1.1'de.

| QUALITY # | Seviye | Konu | İş |
|---|---|---|---|
| G-01 | Kritik | Geçmiş tarihli rezervasyonla anında puan | V2-02 |
| G-02 | Yüksek | Rezervasyon oluşturmada sınır ve tavan yok | V2-03 |
| G-03 | Yüksek | Anahtarsız API açılıyor | V2-04 |
| G-04, G-05 | Yüksek | Kampanya kodu tahmini, tavan yok; seed canlıda kodları ve kurları ezer | V2-05 |
| G-06 | Yüksek | `USE_MOCKS` üretime sızarsa giriş koruması atlanır | V2-06 |
| G-10 | Yüksek | Web server action'larında doğrulama yok | V2-08 |
| G-07, G-08, G-09, G-11–G-15 | Orta | Fail-open `NODE_ENV`, `/api` yönlendirmesi, etkisiz `ValidationPipe`, sınırsız uçlar, parola özeti ve oturum süresi, hesap silmede doğrulama, giriş kilidi | V2-04, V2-06, V2-07, V2-09, V2-10 |

## Yönetim paneli ve Filom (v2, tasarım)

Kurallar [ADMIN.md](ADMIN.md) §6 ve [FLEET.md](FLEET.md) §6'da; uygulandıkça (V2-23, V2-35) burada "Bu PR'da düzeltilenler" düzeninde kayda geçer. Özet: yetki API'de (`AdminGuard`, `CompanyGuard`), yönetici hesabı yalnızca komut satırından, yönetici oturumu 12 saat ve Google kapalı, değiştiren her işlem `AuditLog`'a (alan adları, değer değil), şirketler arası erişim 404, dosya yükleme ADR-28 kurallarıyla.

Tarih: 17 Ekim 2026. Kapsam: `apps/api` kodu, `docs/api/openapi.yaml` sözleşmesi ve web'in API'yi çağırma şekli
(`apps/web/lib/api-post.ts`, `api-request.ts`, `next.config.ts`). Yöntem: kodun satır satır okunması,
yeni testler ve `pnpm audit`.

## Bu PR'da düzeltilenler

| # | Seviye | Bulgu | Düzeltme |
|---|--------|-------|----------|
| S1 | Yüksek | İstemci kimliği `X-Forwarded-For` başlığının **ilk** girdisinden alınıyordu. Bu girdiyi ziyaretçi yazar; her istekte değiştirerek giriş (10/15 dk), kayıt, parola sıfırlama, form ve **araç tutma (istemci başına 5)** sınırları aşılabiliyordu. Aynı işlev `holds.controller.ts` içinde ikinci kez kopyalanmıştı. | Kimlik artık `request.ip`. Express, başlığı yalnızca `TRUST_PROXY_HOPS` kadar proxy'ye güvenerek çözer (varsayılan 1: Next). Tek ortak `clientKeyOf` kullanılır. |
| S2 | Orta | Bellek içi hız sınırlayıcı yalnızca 24 saatten eski kayıtları siliyordu; uydurma anahtarlarla sınırsız büyüyebilirdi (bellek tükenmesi). | v1'de tablo 10.000 anahtarla sınırlandı. V2-09'dan beri sayaçlar veritabanında; eski pencereler günlük görevle siliniyor ve bellek içi sınırlayıcı kodda yok. |
| S3 | Orta | Hata yanıtı biçimi tutarsızdı: bilinmeyen yol, bozuk JSON, büyük gövde sözleşme dışı (`statusCode`, ayrıştırıcı metni) dönüyordu. Beklenmeyen hatalarda ayrıntı sızma riski. | Genel hata filtresi: her hata `{code, message, fieldErrors?}`. Beklenmeyen hata `500 INTERNAL_ERROR` ve sabit metin; ayrıntı yalnızca sunucu günlüğüne (yol ve yöntem, sorgu ve gövde yazılmaz). Yeni kodlar: `PAYLOAD_TOO_LARGE`, `INTERNAL_ERROR`. |
| S4 | Düşük | Swagger sayfası (`/docs`) canlıda da açıktı ve tüm uçları listeliyordu. | Canlıda kapalı; `ENABLE_DOCS=1` ile açılır. |
| S5 | Düşük | Güvenlik başlıkları yoktu; `X-Powered-By` çerçeveyi bildiriyordu; kişiye ait yanıtlar (`/me`, `/auth`, `/reservations`, `/holds`) önbelleğe alınabilirdi. | `nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, kişisel yollarda `Cache-Control: no-store`, `X-Powered-By` kapalı. |
| S6 | Orta | Canlıda `WEB_URL` unutulursa parola sıfırlama bağlantıları `http://localhost:3000` adresine giderdi. | Canlıda `DATABASE_URL` ve `https://` ile başlayan `WEB_URL` yoksa sunucu açılmaz, nedeni yazar. Geçersiz `TRUST_PROXY_HOPS` her ortamda açılışı durdurur. |
| S7 | Düşük | SIGTERM'de veritabanı bağlantısı düzgün kapanmıyordu. | `enableShutdownHooks()`. |
| S8 | Düşük | `.env.example` içinde anahtarsız, açıklamasız bir `http://localhost:3000` satırı vardı. | Açıklamaya çevrildi; yeni değişkenler eklendi. |
| S9 | Yüksek | Yayında API, barındırıcının verdiği herkese açık bir adreste durur; biri doğrudan çağırıp `X-Forwarded-For` uydurabilir (S1'in kapıdan dönmesi). | Web ile API arasında paylaşılan gizli anahtar (`API_ACCESS_KEY`, başlık `X-Novera-Key`). Anahtarsız her istek `404`; ziyaretçi adresi (`X-Novera-Client-IP`) yalnızca anahtar doğruysa kabul edilir. Canlıda anahtar yoksa API açılmaz. `/health` açık kalır, yalnızca `{status:'ok'}` döner. |
| S10 | Orta | Parola sıfırlama bağlantısı canlıda hiçbir yere gönderilmiyordu. | Resend ile gerçek e-posta (HTTPS, SMTP değil). Gönderim yanıtı beklemez, hata fırlatmaz, günlüğe e-posta adresi ya da bağlantı yazmaz; hesap var/yok durumları yanıt süresiyle de ayırt edilemez hale geldi. |
| S11 | Düşük | Boşta kalan veritabanı bağlantıları (Neon 5 dakikada uyur) kopabilir. | Havuz ayarı: en çok 10 bağlantı, boşta 30 sn sonra kapanır, uyanma için 15 sn bekler. |

## İncelendi, sorun bulunmadı

- **SQL enjeksiyonu:** tüm ham sorgular etiketli şablon (`$queryRaw` + `${}`), parametre olarak gider; `Unsafe` kullanımı yok.
- **Parolalar:** scrypt (N=2^17), rastgele tuz, `timingSafeEqual`; olmayan e-postada sahte özetle doğrulama (süre farkı yok).
- **Oturum:** 256 bit rastgele anahtar, veritabanında yalnızca SHA-256 özeti; çerez `httpOnly`, `SameSite=Lax`, canlıda `Secure`. Parola değişince/sıfırlanınca diğer oturumlar ve sıfırlama bağlantıları silinir.
- **Parola sıfırlama:** bağlantı tek kullanımlık, özet saklanır, 1 saat; var olan/olmayan hesap aynı yanıtı verir.
- **Yetki (IDOR):** `/me/*`, iptal, oturum kapatma sorguları hep `userId` ile süzülür; başkasının kaydı 404.
- **Toplu atama:** profil güncellemesi alan alan beyaz listeyle okunur; e-posta ve rol değiştirilemez.
- **Eşzamanlılık:** araç ve (puanla ödemede) kullanıcı satırı kilidi; iki kilit hep aynı sırayla alınır.
- **Girdi:** kimlikler metin sütunu, uydurma kimlik hata değil 404/422 verir; gövde sınırı Express varsayılanı 100 KB (testle kanıtlandı: üstü `413`).
- **CORS:** gerekmiyor (ADR-14: tarayıcı Next üzerinden gelir). Eklenmedi; doğrudan erişim açılırsa yeniden bakılır.
- **CSRF:** `SameSite=Lax` + yalnızca JSON gövdeli POST/PATCH/DELETE. Çapraz site isteğine çerez eklenmez. Kodda tarayıcıdan `/api` çağrısı bulunmadı; tüm çağrılar sunucudan gidiyor.
- **Bağımlılıklar (`pnpm audit`, V2-18):** CI her çalışmada `pnpm audit:prod` koşar (`scripts/audit-prod.mjs`); çalışan uygulamaya giren pakette **yüksek ya da kritik** bulgu varsa kırmızı olur. Çalışan uygulamaya girmeyen bulgular `scripts/audit-allowlist.json` içinde, yalnızca belirli bir bağımlılık yoluna (`pathPrefix`) bağlı, gerekçeli ve gözden geçirme tarihli izin kaydıyla geçer; kayıt 90 günden eskiyse ya da aynı paket başka bir yoldan uygulamaya giriyorsa yine kırmızıdır. Bugünkü izinler (26 Ekim 2026): `deepmerge-ts` (GHSA-ggr8-5vv4-36mx) ve `mysql2` (GHSA-3f6p-5ww8-9rcr); ikisi de yalnızca Prisma **komut satırı aracından** geliyor, çalışan API'de yok (veritabanı sürücüsü `pg`, veritabanı PostgreSQL). Prisma güncellenince bunlar kalkar; betik artık eşleşmeyen kaydı "silinebilir" diye bildirir. `@nestjs/platform-express` `multer`'ı 2.4.0'a sabitlediği için `pnpm-workspace.yaml`'da `overrides` ile 2.5.0'a çekildi (platform-express yamalı sürümü istediğinde kaldırılır). Dependabot haftalık PR açar (`.github/dependabot.yml`), CodeQL her PR'da ve haftada bir çalışır (`.github/workflows/codeql.yml`).

## Google ile giriş (`POST /auth/google`)

- **Doğrulama:** Google'ın ID token'ı API'de `jose` ile doğrulanır: imza (Google'ın herkese açık anahtarları, RS256), `iss` (`accounts.google.com`), `aud` (bizim `GOOGLE_CLIENT_ID`), süre ve `email_verified === true`. İstemci sırrı yoktur. Token tarayıcıdan gelir ama başkasının token'ı bizim Client ID'mize ait olmadığı için kabul edilmez.
- **Hesap ele geçirme (pre-hijack) önlemi:** parolayla kayıtta e-posta doğrulanmıyor. Biri başkasının adresiyle önceden kayıt açmış olabilir. Gerçek sahibi Google ile girince hesap bağlanır, **parola silinir, tüm oturumlar ve sıfırlama bağlantıları iptal edilir**. Sahibi Google ile ya da "şifremi unuttum" ile devam eder.
- **Yalnızca bireysel hesap:** kurumsal hesabı Novera açar; aynı e-postayla Google denemesi `403`.
- **Onay:** yeni hesapta KVKK onayı (`consent: true`) olmadan hesap açılmaz (`422`).
- **Sınır:** 15 dakikada istemci başına 10 deneme. Parolasız hesapta parola girişi, yanlış parola gibi aynı cevabı ve aynı işi yapar (hesap varlığı sızmaz).
- **Veri:** Google'dan yalnızca `sub`, e-posta ve ad saklanır. `googleSub` yanıtta çıkmaz (`googleLinked` bayrağı çıkar).

## Veri saklama (V2-12, KVKK)

Süre kararı G'nindir (SPEC §7, 22 Ekim 2026): iletişim mesajı ve teklif talebi için **2 yıl**, sonra anonimleştirme. Kaynak kod: `apps/api/src/forms/retention.ts` (süre ve silinen alanlar), `retention.task.ts` (günlük görev).

| Veri | Tablo | Ne kadar | Nasıl siliniyor |
| --- | --- | --- | --- |
| İletişim mesajı | `ContactMessage` | Gönderildiği günden 2 yıl | Günlük görev: ad → "Silindi", e-posta ve mesaj boş, telefon boş. Konu, tarih ve onay zamanı istatistik için kalır; `anonymizedAt` dolar |
| Teklif talebi | `QuoteRequest` | Gönderildiği günden 2 yıl; hesap silinirse hemen | Günlük görev ya da hesap silme: iletişim kişisi → "Silindi", e-posta boş, telefon ve notlar boş. Firma adı, araç/süre/şehir bilgisi ve durum kalır; `anonymizedAt` dolar |
| Rezervasyon | `Reservation` | Süresiz (kiralama ve mali kayıt) | Hesap silinince `userId` boşalır; araç, tarih ve tutar kalır, kişiyle bağı kalmaz. Rezervasyonda ad ya da e-posta saklanmaz |
| Hesap, oturum, puan, sıfırlama bağlantısı | `User`, `Session`, `PointTransaction`, `PasswordResetToken` | Hesap açık olduğu sürece | Hesap silinince birlikte silinir (cascade). Süresi dolan oturum ve bağlantılar günlük görevle silinir (V2-10) |
| Hız sınırı sayaçları, giriş bekleme kayıtları | `RateLimitHit`, `LoginThrottle` | Pencere süresi / bir gün | Günlük görev siler. İstemci adresi yalnızca özet olarak tutulur |
| Sürücü belgesi ve doğum tarihi | Saklanmaz | Yalnızca rezervasyon sırasında kontrol edilir | Hiçbir tabloya yazılmaz |

- Görev her açılışta ve 24 saatte bir çalışır (Cloud Run boştayken kapanır, bir sonraki açılışta çalışır); tekrar çalışması zararsızdır, `anonymizedAt` dolu kayıtlara dokunmaz.
- İletişim mesajı bir hesaba bağlı değildir; hesap silinince mesaj kendiliğinden anonimleşmez, 2 yıllık süreyi bekler. Bir kişi daha erken silinmesini isterse KVKK başvurusu (`kvkk@novera.example`) ile elle yapılır.
- Yedekler: Neon'un geri dönüş penceresi 6 saattir; elle alınan yedek branch'ler 24 saat sonra kendiliğinden silinir. Anonimleştirilen veri eski bir yedekten geri gelebilir; yedek kullanılırsa görev ilk çalışmada yeniden anonimleştirir.

## Karar bekleyenler (kodda değiştirilmedi)

1. **Parola sıfırlama isteği süre farkı:** e-posta gönderimi artık beklenmiyor (S10); geriye yalnızca hesap varken yapılan iki küçük veritabanı yazması kaldı. Fark çok küçük ve ağ gürültüsünün içinde kalır; ek önlem gerekmez.
2. **Kayıtta `EMAIL_TAKEN`:** hesap varlığını açık eder; sözleşmeye göre bilinçli (kullanıcıya doğru mesaj). Sınır: saatte 10 kayıt/istemci.
3. **Açık okuma uçlarına sınır yok** (`/vehicles`, `/reservations/price`, ...). Yayında CDN/yük dengeleyici düzeyinde istek sınırı eklenmesi önerilir.
4. **Hız sınırı sayaçları** veritabanındadır (V2-09): birden fazla API sunucusu aynı sayacı görür ve yeniden başlatma onları sıfırlamaz. Her istek bir veritabanı yazması demektir; ölçek çok büyürse depo ADR-27'de yeniden ele alınır.

## Yayın (BACKLOG 40, issue #49) kontrol listesi

Adım adım uygulama: `docs/DEPLOY.md`. Burada yalnızca güvenlik açısından zorunlu olanlar.

- [ ] `NODE_ENV=production` (aksi halde oturum çerezi `Secure` olmaz). Cloud Run'da servisin ortam değişkeni olarak girilir (DEPLOY.md §4).
- [ ] `API_ACCESS_KEY` hem API'de hem web'de **aynı** değerde (en az 32 karakter). Web'in bu anahtarı ve ziyaretçi adresini göndermesi `apps/web/lib/api-headers.ts` ile yapılır. Anahtar olmadan canlı API açılmaz; yanlışsa her çağrı `404` olur.
- [ ] `TRUST_PROXY_HOPS`: API'den önce kaç proxy var. Cloud Run'da `1` (Google'ın yük dengeleyicisi); 28 Ekim'de iki cihazdan denendi, `RateLimitHit`'te farklı `ip:` anahtarları göründü. Ziyaretçi adresi anahtarla gelen `X-Novera-Client-IP` başlığından alınır; canlıda her istek anahtarla geldiği için bu ayar pratikte yalnızca `/health` için geçerlidir, yine de doğru tutulur.
- [ ] `WEB_URL=https://...` ve `DATABASE_URL` tanımlı (yoksa API açılmaz).
- [ ] `/docs` kapalı kalmalı (`ENABLE_DOCS` boş).
- [ ] `RESEND_API_KEY` ve `MAIL_FROM` (alan adı Resend'de doğrulanmış) ya da bilinçli olarak boş: boşsa canlıda parola sıfırlama e-postası gitmez.
- [ ] Veritabanı yedeği alınıyor ve geri yükleme **denendi** (`DEPLOY.md` 9. adım). Veritabanı parolası geliştirme değerinden (`novera_dev`) farklı.
- [ ] Google Maps anahtarı siteye (HTTP referrer) kısıtlı.
- [ ] Canlıda `curl`/`Invoke-WebRequest` ile anahtarsız istek `404`, `/docs` `404` (`DEPLOY.md` 8. adım).
- [ ] Web tarafı (G): CSP ve HSTS zaten var (`next.config.ts`, `proxy.ts`); canlı alan adında doğrulanmalı.

## Bilinen sınırlar (canlıda)

- Cloud Run boştayken sıfır örneğe iner, ilk istek birkaç saniye sürebilir (soğuk başlangıç); Google istediği zaman örneği yeniden başlatabilir. Hız sınırı sayaçları veritabanında olduğu için yeniden başlatma onları sıfırlamaz (V2-09).
- Neon Free'nin geri dönüş penceresi 6 saattir; uzun süreli yedek haftalık elle alınır.