# Yayın rehberi (BACKLOG 40, issue #49)

Bu rehber, siteyi sıfırdan internete açmanın adımlarını sırasıyla anlatır. Her adımın sonunda "doğru çalıştığını nasıl anlarsın" kısmı var.
Gizli değerleri (veritabanı adresi, API anahtarları) **hiçbir yere yapıştırma**: Git'e, sohbete, ekran görüntüsüne girmesin.

## Kararlar

| Parça | Seçim | Neden |
|-------|-------|-------|
| Web (Next.js) | **Vercel** (Hobby) | ADR-12'deki öneri; Next.js'i kendisi yapıyor. Hobby plan yalnızca kişisel, ticari olmayan kullanım içindir: bu proje kurgusal bir demo olduğu için uygundur. Gerçek müşteriyle çalışılacaksa Pro plana geçilir. |
| API (NestJS) | **Google Cloud Run** (europe-west1, Belçika; Tier 1), Docker kapsayıcısı | 27 Ekim'de karar: Render'ın aylık 750 saatlik havuzu başka bir projeyle paylaşılıyordu ve ücretsiz plan uyuyordu. Cloud Run istek gelmezse sıfır örneğe iner (boştayken ücret yok), aylık ücretsiz kotası küçük bir site için yeterli. Bölge Tier 1 olduğu için ücretsiz kota daha uzun yeter ve birim fiyat düşüktür; Neon Frankfurt'ta, yani her veritabanı sorgusu biraz daha uzun sürer (trafik küçük, ölçülen bir sorun yok). **Bütçe uyarısı ve harcama sınırı şart** (aşağıda). E-posta için SMTP portları kapalı olabileceğinden HTTPS ile çalışan Resend kullanılıyor. |
| Veritabanı | **Neon** (Free, Frankfurt) | Render'ın ücretsiz PostgreSQL'i 30 günde siliniyor, bu yüzden kullanılmıyor. Neon Free: 1 GB, kullanılmayınca uyur (ilk istek biraz yavaş), son 6 saate geri dönüş (restore) var. |
| E-posta | **Resend** (Free) | Parola sıfırlama bağlantısı için. Kendi alan adın olmadan yalnızca kendi e-posta adresine gönderebilir. |
| Uyandırma | ~~UptimeRobot~~ gerekmiyor | Cloud Run sıfıra iner ve ilk istekte birkaç saniyede açılır (soğuk başlangıç); Vercel'in 10 saniyelik sınırının içinde kalır. Uyandırma izlemesi boşuna istek ve ücret demek olur. |

Güncel koşullara 17 Ekim 2026'da bakıldı (Render ve Neon'un kendi sayfaları); Cloud Run'ın ücretsiz kotası ve fiyatları Ekim 2026'da konsoldaki fiyat tablosundan okundu. Koşullar değişebilir: bu yüzden aşağıdaki bütçe uyarısı zorunlu. Vercel Hobby sınırlarını Vercel'in kendi sayfasından değil bir üçüncü taraf yazısından aldım; Vercel'de proje açarken plan sayfasını bir kez kontrol et. Üç servis de koşullarını sık değiştiriyor.

## Başlamadan önce

- [ ] G'nin web değişikliği main'de (`web-patch.md`): web, API'ye gizli anahtarı ve ziyaretçi adresini gönderiyor. Bu olmadan canlı API tüm istekleri 404'ler.
- [ ] API'nin `Dockerfile`'ı (depo kökünde) main'de.
- [ ] Hesapların: GitHub (var), Neon, Google Cloud (faturalaması **ücretli hesaba yükseltilmiş**, bütçe uyarısı kurulu), Vercel (hepsi GitHub ile giriş yapılabilir), isteğe bağlı Resend.

## 1. Neon: veritabanı

1. neon.com → Sign up (GitHub ile).
2. **Create project**: ad `novera`, Postgres sürümü **17**, bölge **AWS Europe (Frankfurt)**.
3. Proje açılınca **Connect** düğmesine bas. **"Connection pooling" kutusunu KAPAT** (doğrudan bağlantı gerekiyor). Çıkan adres `postgresql://...neon.tech/neondb?sslmode=require` biçimindedir. Bunu bir yere **kopyala** (not defterinde geçici dursun; işin bitince sil).

Doğru mu? Adreste `-pooler` geçmemeli.

## 2. Tabloları ve örnek verileri yükle (bilgisayarından, bir kere)

PowerShell'de (adresi kendi adresinle değiştir, tırnaklar kalsın):

```powershell
cd D:\dev\novera\apps\api
$env:DATABASE_URL = "BURAYA-NEON-ADRESI"
pnpm exec prisma migrate deploy
pnpm db:seed
Remove-Item Env:DATABASE_URL
```

`migrate deploy` "All migrations have been successfully applied" demeli, `db:seed` hata vermeden bitmeli. Seed sahte hesap oluşturmaz, yalnızca bayiler, araçlar, ek hizmetler ve kurlar.

> **Seed canlıda güvenlidir (V2-05, QUALITY G-05):** seed var olan iş verisinin üzerine yazmaz. Kurlar, kampanya kodları, araç modeli günlük fiyatları ve ek hizmet fiyatları yalnızca **eksikse** eklenir; var olan bir kodun durumuna, tarihlerine ve yüzdesine dokunulmaz. Örnek kodlar (`NOVERA10`, `HOSGELDIN`) yalnızca `SEED_DEMO=1` verilirse ve yoksa eklenir, 30 gün geçerlidir:
>
> ```powershell
> $env:SEED_DEMO = "1"; pnpm db:seed; Remove-Item Env:SEED_DEMO   # yalnızca örnek kodları da istiyorsan
> ```
>
> Canlıda `SEED_DEMO` vermeden çalıştırmak yeterlidir. Bayi, araç, SSS ve içerik alanları ise hâlâ seed'deki değerlerle güncellenir (yönetim paneli gelince V2-27, V2-29 ve V2-30'da yeniden bakılacak).
`.env` dosyana dokunulmadı; yerel veritabanın aynı kalır. (Adres PowerShell geçmişine yazılmış olabilir; işin bitince Neon'da parolayı yenileyebilirsin: Connect → Reset password.)

Neon panelinde **Tables** sekmesinde `Branch`, `Vehicle` vb. tabloları ve içlerinde satırları görmelisin.

## 3. Resend: e-posta (isteğe bağlı, sonra da yapılabilir)

E-posta ayarı olmadan site çalışır; "Şifremi unuttum" bağlantısı gönderilmez (canlıda log'a da yazılmaz). Render'dan taşırken değerler **kendiliğinden gelmez**: Cloud Run'da `RESEND_API_KEY` ve `MAIL_FROM` ayrıca girilmelidir (aşağıdaki 4. adımın sonu).

1. resend.com → Sign up → **API Keys** → Create (izin: *Sending access*). Anahtarı kopyala.
2. Kendi alan adın varsa **Domains** → ekle ve istenen DNS kayıtlarını gir; sonra `MAIL_FROM` = `Novera Mobility <noreply@senin-alan-adin>`.
3. Alan adın yoksa: `MAIL_FROM` = `Novera Mobility <onboarding@resend.dev>` ve e-posta **yalnızca Resend'e kayıt olduğun adrese** gider. Demo için yeter.

## 4. Google Cloud Run: API

API, kökteki `Dockerfile` ile bir kapsayıcı olarak çalışır. Google, GitHub'daki kodu kendisi derler (Cloud Build) ve `main`'e her birleşmede yeniden yayınlar. Hiçbir şeyi bilgisayarında derlemen gerekmez.

**Önce (bir kere): ücret koruması.** Faturalama hesabı ücretli olmalı (deneme bitince servisler durur) ve şunlar kurulu olmalı: **Billing → Budgets & alerts** altında bir bütçe (öneri: ayda 250 ₺, %50 / %90 / %100'de e-posta). İsteğe bağlı: aynı bütçede **Spend cap enforcement** ile yalnızca *Cloud Run* seçilir; tutar dolunca Cloud Run durur (API kapanır), bu bir hata ya da saldırıda masrafı keser. Harcama verisi gecikmeli geldiği için kesin bir sınır değildir.

1. **API'leri aç.** Konsolda (proje **Novera Mobility**) arama kutusuna sırayla `Cloud Run Admin API`, `Cloud Build API`, `Artifact Registry API`, `Secret Manager API` yaz, her birinde **Enable**. (Servisi oluştururken konsol bazılarını kendisi de ister.)
**İzinler (27 Ekim'de yaşandı):** derlemeyi ve servisi çalıştıran hesap *Compute Engine default service account*'tır (`<proje-numarası>-compute@developer.gserviceaccount.com`). Yeni projelerde şu rolleri vermen gerekir, yoksa derleme günlük bile yazamaz ve servis gizli değerleri okuyamaz: *Cloud Build Service Account*, *Cloud Run Admin*, *Service Account User*, *Artifact Registry Writer*, *Logs Writer*, *Secret Manager Secret Accessor* (**IAM & Admin → IAM → hesabın kalem simgesi → Add another role**). Aynı hesap hem derleme hem çalışma kimliği olduğu için yetkileri geniştir; ileride API için yalnızca gizli değer okuyabilen ayrı bir hesap kurulması iyi olur.

2. **Gizli değerleri hazırla** (hiçbirini sohbete, Git'e ya da ekran görüntüsüne koyma):
   - `API_ACCESS_KEY`: en az 32 karakterlik rastgele bir metin. PowerShell'de üret: `-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})`. Bir kere not al; hem Cloud Run'a hem Vercel'e girilecek.
   - `DATABASE_URL`: Neon adresi (1. adım, pooling KAPALI).
3. **Gizli değerleri Secret Manager'a koy:** arama kutusuna `Secret Manager` → **Create secret**: ad `api-access-key`, değer anahtar; sonra ad `database-url`, değer Neon adresi. Diğer ayarlar varsayılan.
4. **Servisi oluştur:** `Cloud Run` → **Create service** → **Continuously deploy from a repository** → **Set up with Cloud Build**:
   - Repository: GitHub ile bağlan (Google Cloud Build uygulamasını yalnızca `Novera-Mobility` deposuna yetkilendir), depoyu seç.
   - Branch: `^main$`. Build type: **Dockerfile**, Source location: `/Dockerfile` (kökteki dosya; Google derleme bağlamı olarak Dockerfile'ın klasörünü kullanır, bu yüzden `apps/api` içinde olamaz). **Save**.
   - **Konsol tetikleyicisini bir kere düzelt** (27 Ekim'de yaşandı): konsol, tetikleyicinin satır içi (Inline) yapılandırmasına derleme klasörünü sabit yazar. Servis oluşunca **Cloud Build → Triggers →** tetikleyici → **Configuration** (tür *Cloud Build configuration file*, konum *Inline*) → **Open editor**: `Build` adımındaki `- apps/api` satırını `- .`, `- apps/api/Dockerfile` satırını `- Dockerfile` yap; editörün **Done** düğmesine bas (sağ üstteki X değişikliği atar), sonra sayfanın altındaki **Save**'e bas. `Push` ve `Deploy` adımlarına dokunma. Kaydı doğrulamak için editörü yeniden aç.
   - Tetikleyicide **Send build logs to GitHub** ve **Require approval** kutuları boş kalsın (depo açık olduğu için derleme günlüğü herkese görünür olmasın).
   - Service name: `novera-mobility` (konsolun önerdiği ad; başka bir ad seçersen aşağıdaki yapılandırmadaki `_SERVICE_NAME` değeri de o olur). Region: **europe-west1 (Belgium)**.
   - **Authentication: Allow public access.** Adres herkese açık görünür ama API, `X-Novera-Key` başlığı olmayan her isteğe 404 verir; Vercel'in sunucusu bu başlığı gönderir.
   - **Billing: Request-based.** **Autoscaling: Minimum instances 0, Maximum instances 2** (masrafı sınırlar).
   - **Container(s) → Container port: 8080.** CPU 1, bellek 512 MiB, **Request timeout** 60 sn.
5. **Variables & Secrets** sekmesi:
   - Ortam değişkenleri: `NODE_ENV` = `production`, `TRUST_PROXY_HOPS` = `1`, `WEB_URL` = Vercel adresi (`https://....vercel.app`, sonunda `/` yok), isteğe bağlı `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, `MAIL_FROM` (Render'daki gibi, boş bırakılabilir).
   - **Reference a secret**: `API_ACCESS_KEY` ← `api-access-key` (latest), `DATABASE_URL` ← `database-url` (latest). Konsol, hizmet hesabına gizli değere erişim izni vermeyi önerirse **Grant** de.
6. **Create.** İlk derleme ve yayın birkaç dakika sürer. Bitince servisin adresi görünür (`https://novera-api-....europe-west3.run.app`). Bunu not al; `API_URL` olacak.

Doğru mu?
- Tarayıcıda `…/health` aç: `{"status":"ok"}` görünmeli.
- `…/branches` aç: `{"code":"NOT_FOUND",...}` görünmeli. **Bu doğru ve istenen sonuç**: anahtarı olmayan kimse API'yi kullanamaz.
- Cloud Run → `novera-api` → **Logs** sekmesinde `The API cannot start in production: ...` varsa eksik bir değer vardır (hata değeri yazmaz, hangisinin eksik olduğunu söyler).

**Migration** artık sunucu başlarken çalışmaz (soğuk başlangıç beklemesin, iki örnek yarışmasın). Her yeni migration'ı, **yeni sürüm yayına girmeden önce**, 2. adımdaki gibi bilgisayarından uygula: `pnpm exec prisma migrate deploy` (önce Neon yedeği). Geri alınamayan migration varsa önce web, sonra migration (PR açıklamasında yazar).

**Ziyaretçi adresi kontrolü (ilk canlı denemede bir kere):** hız sınırı ziyaretçileri adreslerinin özetiyle ayırır. Cloud Run'ın önünde Google'ın yük dengeleyicisi vardır ve istek Vercel'den gelir; `TRUST_PROXY_HOPS=1` bu varsayıma göre konuldu. Sitede iki farklı cihazdan (telefon ve bilgisayar) birkaç sayfa aç, sonra Neon → **SQL Editor**'de `select key, bucket from "RateLimitHit" order by "windowStart" desc limit 20;` çalıştır. İki cihaz **farklı** `ip:...` değerleri vermeli. Hepsi aynı değerse API ziyaretçileri ayıramıyordur: o zaman `TRUST_PROXY_HOPS` değerini birlikte düzeltiriz; yanlış kalırsa herkes aynı sınırı paylaşır.

**E-postayı bağla (3. adımdan sonra):** Resend anahtarını Secret Manager'a koy (`resend-api-key`), sonra Cloud Run → `novera-mobility` → **Containers** → **Edit** → **Variables & secrets**: **Reference a secret** `RESEND_API_KEY` ← `resend-api-key` (latest) ve **Add variable** `MAIL_FROM` (3. adımdaki değer) → **Done** → **Deploy**. Denemek için Resend'e kayıt olduğun adresle bir hesap aç ve "Şifremi unuttum"u kullan.

## 5. Vercel: web

1. vercel.com → Sign up (GitHub) → **Add New → Project** → `Novera-Mobility`.
2. **Root Directory**: `apps/web` (Edit'e basıp seç). Framework otomatik "Next.js" seçilir.
3. **Environment Variables** (hepsi Production):
   - `API_URL` = Cloud Run adresi (4. adım, sonunda `/` olmasın).
   - `API_ACCESS_KEY` = 4. adımda ürettiğin anahtarın **aynısı** (Cloud Run'daki `api-access-key` gizli değeriyle bir olmalı).
   - `NEXT_PUBLIC_SITE_URL` = bu projenin Vercel adresi (ilk deploy'dan sonra öğrenirsin, sonra eklenir/değişir).
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = harita anahtarın. **Google Cloud'da anahtarı siteye kısıtla** (HTTP referrer: Vercel adresin), yoksa başkası kullanıp faturanı şişirebilir.
   - `USE_MOCKS` **ekleme** (boş kalsın; canlıda örnek veri kapalı olmalı).
   - Analytics değerleri boş kalsın.
4. **Deploy**. Bitince Vercel sana adres verir (`https://....vercel.app`).
5. İlk deploy'dan sonra: `NEXT_PUBLIC_SITE_URL`'i bu adresle düzelt, **Redeploy**.

## 5a. Vercel Blob: fotoğraf deposu (V2-28)

Panelden yüklenen araç modeli fotoğrafları kodun içinde değil, **Vercel Blob**'da durur (ADR-28; karar 29 Ekim 2026, Berkay). Yükleme ekranı V2-29'da (araç modeli formu) gelir; depoyu ve anahtarı şimdiden kurabilirsin, ilk gerçek deneme V2-29 birleşince yapılır.

**Koşullar** (Vercel'in kendi sayfalarından, **29 Ekim 2026'da okundu**: [fiyat ve sınırlar](https://vercel.com/docs/vercel-blob/usage-and-pricing), [sunucudan yükleme](https://vercel.com/docs/vercel-blob/server-upload)). Koşullar değişebilir; yeniden bak.

| | Hobby (ücretsiz) |
|---|---|
| Depolama | 1 GB |
| Basit işlem (adresten erişim, önbellek ıskası) | ilk 10.000 |
| Gelişmiş işlem (yükleme, kopyalama, listeleme, mağaza oluşturma) | ilk 2.000 |
| Veri aktarımı | ilk 10 GB; diğer Vercel hizmetleriyle ortak havuz |
| Sınır aşılırsa | **ücret çıkmaz**, ama Blob'a erişim 30 gün kapanır; limite yaklaşınca e-posta gelir |
| Sunucudan yükleme | gövde en çok **4,5 MB** (Vercel Functions sınırı) |

Bir model fotoğrafı yaklaşık 200–500 KB'tır (2000 px'e küçültülmüş WebP); 1 GB, birkaç bin fotoğraf demektir, yani bu proje için çok fazla. Hobby plan yalnızca ticari olmayan kullanım içindir (bkz. Kararlar tablosu).

**Kurulum:**
1. Vercel'de projeyi aç → **Storage** → **Create Storage** → **Blob** → erişimi **Public** seç (fotoğraflar sitede herkese görünür; **Private** seçersen adresler açılmaz) → adı `Photos` → ortamlar: **Production** ve **Preview** (yerelde denemek istersen **Development** de) → **Create**.
2. Vercel, projeye `BLOB_READ_WRITE_TOKEN` (ve OIDC için `BLOB_STORE_ID`) ortam değişkenlerini kendisi ekler. **Anahtarı kopyalama, sohbete ya da repoya yazma.** Vercel üzerinde kod kimlik bilgisini kendisi bulur; token yalnızca yerelde ya da Vercel dışında gerekir.
3. Mağazanın genel adresini öğren: mağaza sayfasında ya da ilk yüklenen dosyanın adresinde `https://<kimlik>.public.blob.vercel-storage.com`. `<kimlik>.public.blob.vercel-storage.com` kısmını **iki yere** ortam değişkeni olarak gir (gizli değildir):
   - Vercel (web): `BLOB_PUBLIC_HOST`. Sitenin güvenlik politikası (CSP `img-src`) yalnızca bu adresten görsele izin verir.
   - Cloud Run (API): `BLOB_PUBLIC_HOST`. API, `imageUrl` olarak yalnızca bu adresi (ya da `/fleet/` ile başlayan site içi yolu) kabul eder; başka bir Blob mağazasının adresi reddedilir.
   Boş bırakılırsa ikisi de mağaza ailesinin (`*.public.blob.vercel-storage.com`) herhangi bir adresini kabul eder; üretimde doldur.
4. Web'i yeniden yayınla (ortam değişkeni yeni yayınla geçerli olur).

**Nasıl çalışır:** panel formu fotoğrafı web sunucusundaki bir Server Action'a gönderir. Tarayıcı fotoğrafı önce 2000 px genişliğe ve WebP'ye küçültür (5 MB'lık bir telefon fotoğrafı böylece 4,5 MB sınırına takılmaz); sunucu dosyanın ilk baytlarından türünü anlar (yalnızca JPEG/PNG/WebP), en az 1200 px genişlik ister, EXIF'i siler, yeniden WebP yapar ve rastgele bir adla `vehicle-models/` klasörüne yazar. API'ye yalnızca dönen adres gider. Yükleme yapılıp form kaydedilmezse kalan dosya silinmez (v2'de kabul edildi); gerekirse Vercel panelinden elle silinir.

## 6. Adresleri birbirine tanıt

Cloud Run → `novera-mobility` → **Containers** sekmesi → **Edit** → **Variables & secrets** → `WEB_URL` = Vercel adresi (`https://....vercel.app`, sonunda `/` olmasın) → **Done**; sağ üstte **Deploy**. (Konsolun yeni arayüzünde "Edit & deploy new revision" düğmesi yoktur; ayarlar sekmelerden düzenlenir.)

## 7. (Gerekmiyor) UptimeRobot

Render'da API'yi uyanık tutmak için vardı. Cloud Run'da gerekmez ve boşuna istek demektir; bir UptimeRobot izleyicisi kurduysan sil.

## 8. Canlı deneme (SPEC §8 akışı)

Vercel adresinde sırayla: ana sayfa açılıyor mu → araç ara → sonuç listesi → **Kirala** → özet (geri sayım) → kayıt ol → rezervasyon yap → **Hesabım**'da rezervasyon görünüyor mu → iptal et → çıkış yap → tekrar giriş yap. Sonra "Şifremi unuttum": e-posta geliyor mu (3. adımı yaptıysan).

Güvenlik kontrolleri (PowerShell):

```powershell
# Anahtarsız istek reddedilmeli: 404
try { Invoke-WebRequest https://<cloud-run-adresi>/branches } catch { $_.Exception.Response.StatusCode.value__ }
# Swagger sayfası kapalı olmalı: 404
try { Invoke-WebRequest https://<cloud-run-adresi>/docs } catch { $_.Exception.Response.StatusCode.value__ }
```

İkisi de `404` yazmalı. Tarayıcıda siteye girip geliştirici araçlarında (F12 → Application → Cookies) `novera_session` çerezinin **HttpOnly** ve **Secure** olduğunu doğrula.

## 9. Yedek

- Neon Free son **6 saate** geri dönüş sağlar (Neon paneli → Backup & Restore). Bu "yanlışlıkla sildim" için; uzun süreli yedek değildir.
- Haftada bir kendi bilgisayarına tam yedek al (Docker açık olsun; Neon adresini yazarken PowerShell'de çift tırnak kullan):

```powershell
docker exec novera-db pg_dump "BURAYA-NEON-ADRESI" -Fc -f /tmp/novera.dump
docker cp novera-db:/tmp/novera.dump D:\yedekler\novera-2026-10-17.dump
docker exec novera-db rm /tmp/novera.dump
```

Yedek dosyaları kişisel veri içerir: **Git'e koyma**, herkese açık bir yere yükleme.
- Geri yükleme denemesi yapılmamış yedek, yedek sayılmaz: bir kez boş bir Neon projesine `pg_restore` ile yüklemeyi dene (adımlar §9c).

## 9c. Geri yükleme denemesi (V2-45)

Geri yüklenmemiş yedek, yedek sayılmaz. Bu deneme bir kez yapılır ve sonucu `docs/issues/V2-45-canli-ortam.md` içindeki "Deneme kaydı" tablosuna yazılır (tarih, süre, tablo sayısı, satır sayıları aynı mı). Deneme **canlı veritabanına yazmaz**: yedeği ayrı, boş bir Neon projesine yükler. Bilgisayarında Docker açık ve `novera-db` kapsayıcısı çalışıyor olmalı (§2). Bağlantı adreslerini hiçbir yere yazma; her seferinde `Read-Host` ile gir.

1. **Boş bir Neon projesi aç:** Neon → **New project** (örn. `novera-restore-test`), Postgres sürümü canlı projeyle aynı. **Connect** penceresinde havuzlamayı (*Connection pooling*) kapat ve adresi kopyala. (Deneme bitince projeyi sil, adım 7.)
2. **Yedeği al** (§9'daki komut; süreyi ölçmek için `Measure-Command` içinde):

```powershell
$env:LIVE_URL = Read-Host "Canli Neon baglanti dizesi"
```

```powershell
Measure-Command { docker exec novera-db pg_dump $env:LIVE_URL -Fc -f /tmp/novera.dump }
```

3. **Boş projeye yükle** (adresi yine sor; çıkan süre "süre" satırına yazılır):

```powershell
$env:TEST_URL = Read-Host "Bos test projesinin baglanti dizesi"
```

```powershell
Measure-Command { docker exec novera-db pg_restore --no-owner --no-acl -d $env:TEST_URL /tmp/novera.dump }
```

`pg_restore` "already exists" gibi uyarılar verirse proje boş değildir; yeni bir proje aç. Sürüm uyuşmazlığı ("unsupported version") çıkarsa `docker exec novera-db pg_dump --version` ile Neon'daki sürümü karşılaştır.
4. **Satır sayılarını karşılaştır:** aynı sorgu iki veritabanında çalışır (yalnız tablo adı ve sayı yazar, kişisel veri yazmaz):

```powershell
docker cp scripts/row-counts.sql novera-db:/tmp/row-counts.sql
```

```powershell
docker exec novera-db psql $env:LIVE_URL -f /tmp/row-counts.sql
```

```powershell
docker exec novera-db psql $env:TEST_URL -f /tmp/row-counts.sql
```

İki liste **satır satırına aynı** olmalı (canlıya o arada yazılan bir kayıt 1–2 satır fark yaratabilir; fark varsa nedenini yaz). `_prisma_migrations` sayısı = migration klasörü sayısı.
5. **Uygulama açılıyor mu (isteğe bağlı ama önerilir):** API'yi yerelde `DATABASE_URL` = test projesi ile açıp `GET /branches` dene; satırlar canlıdakilerle aynı gelmeli.
6. **Temizlik:** dökümü ve ortam değişkenlerini sil:

```powershell
docker exec novera-db rm /tmp/novera.dump /tmp/row-counts.sql
```

```powershell
Remove-Item Env:LIVE_URL, Env:TEST_URL
```

7. Neon'da `novera-restore-test` projesini sil. Yedek dosyası kişisel veri içerir: Git'e koyma.

## 9d. Canlıyı dışarıdan denetle (V2-45)

`pnpm check:live` canlı siteye dışarıdan bakar ve neyin eksik kaldığını söyler; yalnız okur. Sitenin ve API'nin adresiyle çalıştır:

```powershell
pnpm check:live --web https://SITE-ADRESIN --api https://API-ADRESIN
```

Şunları denetler: `sitemap.xml` ve `robots.txt` gerçek alan adını gösteriyor mu (`NEXT_PUBLIC_SITE_URL` doğru mu), ana sayfanın canonical ve paylaşım adresi gerçek alan adı mı, CSP (nonce'lu), `nosniff`, `X-Frame-Options` ve HSTS var mı, API `/health` cevap veriyor mu, **anahtarsız API isteği `404`** mu, **`/docs` kapalı** mı. API anahtarının doğru olduğunu da görmek için **yalnız bu komut için** anahtarı ortam değişkenine koy (yazdırılmaz, günlüğe girmez):

```powershell
$env:NOVERA_API_KEY = Read-Host "API_ACCESS_KEY"
```

```powershell
pnpm check:live --api https://API-ADRESIN
```

```powershell
Remove-Item Env:NOVERA_API_KEY
```

Çıktının son satırı "N of N checks passed" olmalı. Betik (`scripts/check-live.mjs`) bu dosyadaki ve SECURITY.md'deki yayın listesinin dışarıdan sınanabilen maddelerini kapsar; Maps kısıtı, yönetici girişi ve yedek elle sınanır (aşağıda).

### Google Maps anahtarının kısıtını denemek

Kısıt çalışıyorsa anahtar **başka bir alan adında** çalışmaz. Denemek için anahtarı kendi bilgisayarında, listede olmayan bir adreste kullan: `apps/web/.env.local` içine anahtarı yaz, `pnpm dev` ile `http://localhost:3000/bayilerimiz` aç. Anahtar yalnız site adresine kısıtlıysa harita açılmaz ve tarayıcı konsolunda `RefererNotAllowedMapError` görünür (sayfa listeyle çalışır). Harita açılıyorsa kısıt yok ya da `localhost` listede demektir: Google Cloud → APIs & Services → Credentials → anahtar → **Websites** listesini düzelt. Denemeden sonra `.env.local` dosyasını sil. Sonucu (tarih ve "açılmadı / RefererNotAllowedMapError") V2-45 issue'sundaki deneme notuna yaz. Kota için aynı sayfada "Quotas" bölümünden günlük bir üst sınır koy.

## 9a. v2 ile gelecek ayarlar

Bunlar ilgili iş birleşince bu rehbere adım olarak yazılır; burada yalnızca ne geleceği listelenir.

| Ne | İş | Nerede |
|---|---|---|
| Fotoğraf deposu: Vercel Blob (`BLOB_READ_WRITE_TOKEN`, `BLOB_PUBLIC_HOST`); adımlar §5a, koşullar 29 Ekim 2026 tarihli | V2-28 | Vercel ve Cloud Run |
| İlk yönetici hesabı (`pnpm admin:create`) | V2-23, V2-45 | Neon (Berkay'ın bilgisayarından) |
| Şarj istasyonu ve rota seed'i: `pnpm --filter @novera/api db:seed:simulation` (yalnız eksikleri ekler; tam `db:seed` canlıda bayi, model ve araç düzenlemelerini geri yazar, bunun için kullanılmaz). Örnek şirket seed'i ayrı (`FLEET_SEED_PASSWORD`) | V2-35, V2-40, V2-43 | Neon |
| Kullanıcı parolası için seed ortam değişkeni (repoya yazılmaz) | V2-35 | Berkay'ın bilgisayarı |
| `NODE_ENV=production` artık zorunlu güvenlik ayarı; `API_ACCESS_KEY` olmadan API açılmaz | V2-04 | Cloud Run |
| Her migration öncesi yedek | V2-11 ve sonrası | Neon |

## 10. Kendi alan adın olunca

Vercel → **Settings → Domains** → alan adını ekle ve DNS kayıtlarını gir. Sonra: Vercel `NEXT_PUBLIC_SITE_URL`, Cloud Run `WEB_URL` ve Resend alan adı yeni adrese çevrilir. Çerezler yeni adreste yeniden başlar (herkes bir kez giriş yapar).

## Sorun giderme

| Belirti | Sebep ve çözüm |
|---------|----------------|
| Sitede her şey "hizmet kullanılamıyor" | `API_URL` yanlış ya da Cloud Run durmuş (harcama sınırı dolmuş olabilir: Billing → Budgets, ve Cloud Run → Logs). Cloud Run `/health` adresini aç. |
| Giriş/kayıt "kullanılamıyor" ama `/health` çalışıyor | `API_ACCESS_KEY` Vercel'de ve Cloud Run'daki gizli değerde farklı. Secret Manager'daki değeri kontrol et, Vercel'i **Redeploy** et. |
| Çok kişi aynı anda "çok fazla istek" alıyor | Ziyaretçi adresi API'ye ulaşmıyor: web yaması (`web-patch.md`) eksik ya da `TRUST_PROXY_HOPS` yanlış. |
| Giriş yapınca hemen çıkış oluyor | Çerez `Secure` ve site `http` üzerinden açılıyor. Canlıda her zaman `https` kullan. |
| Parola sıfırlama e-postası gelmiyor | `RESEND_API_KEY`/`MAIL_FROM` boş ya da alan adı doğrulanmamış. Cloud Run günlüğünde (Logs) `The mail provider answered 4xx` satırına bak (e-posta adresi günlüğe yazılmaz). |
| İlk istek yavaş | Neon uykudan uyanıyor (birkaç yüz ms); normal. |

## Google ile giriş (isteğe bağlı)

Siteye "Google ile devam et" düğmesi koymak için bir kez Google Cloud'da Client ID üretilir. Sır değildir, gizli anahtar gerekmez.

1. console.cloud.google.com → proje oluştur (ör. `novera-mobility`).
2. **APIs & Services → OAuth consent screen**: uygulama adı `Novera Mobility`, destek e-postası kendi adresin, kapsamlar yalnızca `email`, `profile`, `openid` (varsayılan). Test aşamasında kullanıcı türü **External**; "Publish app" yapılana kadar yalnızca eklediğin test kullanıcıları girebilir.
3. **Credentials → Create credentials → OAuth client ID** → türü **Web application**. **Authorized JavaScript origins**: `https://novera-mobility.vercel.app` ve yerelde denemek için `http://localhost:3000` (yol ya da sondaki `/` yazma). "Authorized redirect URIs" boş kalır.
4. Çıkan Client ID'yi (`...apps.googleusercontent.com`) **aynı değerle** iki yere gir: Cloud Run → `GOOGLE_CLIENT_ID` ve Vercel → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. İkisini de **yeniden dağıt** (Cloud Run'da yeni revizyon yayınla, Vercel için Redeploy).
5. Canlıda kontrol: giriş sayfasında Google düğmesi görünür; yanlış değer girilirse düğme "invalid client" der, API ise `401 GOOGLE_TOKEN_INVALID` döner. `GOOGLE_CLIENT_ID` boşsa API `503 GOOGLE_SIGNIN_UNAVAILABLE` verir ve web düğmeyi göstermez.
