# Yayın rehberi (BACKLOG 40, issue #49)

Bu rehber, siteyi sıfırdan internete açmanın adımlarını sırasıyla anlatır. Her adımın sonunda "doğru çalıştığını nasıl anlarsın" kısmı var.
Gizli değerleri (veritabanı adresi, API anahtarları) **hiçbir yere yapıştırma**: Git'e, sohbete, ekran görüntüsüne girmesin.

## Kararlar

| Parça | Seçim | Neden |
|-------|-------|-------|
| Web (Next.js) | **Vercel** (Hobby) | ADR-12'deki öneri; Next.js'i kendisi yapıyor. Hobby plan yalnızca kişisel, ticari olmayan kullanım içindir: bu proje kurgusal bir demo olduğu için uygundur. Gerçek müşteriyle çalışılacaksa Pro plana geçilir. |
| API (NestJS) | **Render** (Free, Frankfurt) | Kredi kartı istemez, Node'u doğrudan çalıştırır. Dikkat: 15 dakika istek gelmezse uyur, uyanması ~1 dakika sürer (aşağıda UptimeRobot ile çözülüyor). E-posta için SMTP portları (25, 465, 587) Free planda kapalı; bu yüzden e-postayı HTTPS ile çalışan Resend'den gönderiyoruz. |
| Veritabanı | **Neon** (Free, Frankfurt) | Render'ın ücretsiz PostgreSQL'i 30 günde siliniyor, bu yüzden kullanılmıyor. Neon Free: 1 GB, kullanılmayınca uyur (ilk istek biraz yavaş), son 6 saate geri dönüş (restore) var. |
| E-posta | **Resend** (Free) | Parola sıfırlama bağlantısı için. Kendi alan adın olmadan yalnızca kendi e-posta adresine gönderebilir. |
| Uyandırma | **UptimeRobot** (Free) | API'ye 5 dakikada bir `/health` isteği atar, Render uyumaz. Bir Free servis ayda 744 saat çalışır, Render'ın 750 saat hakkı içinde kalır. |

Güncel koşullara 17 Ekim 2026'da bakıldı (Render ve Neon'un kendi sayfaları). Vercel Hobby sınırlarını Vercel'in kendi sayfasından değil bir üçüncü taraf yazısından aldım; Vercel'de proje açarken plan sayfasını bir kez kontrol et. Üç servis de koşullarını sık değiştiriyor.

## Başlamadan önce

- [ ] G'nin web değişikliği main'de (`web-patch.md`): web, API'ye gizli anahtarı ve ziyaretçi adresini gönderiyor. Bu olmadan canlı API tüm istekleri 404'ler.
- [ ] Bu PR (API anahtarı, e-posta, `render.yaml`) main'e merge edilmiş.
- [ ] Hesapların: GitHub (var), Neon, Render, Vercel, UptimeRobot (hepsi GitHub ile giriş yapılabilir), isteğe bağlı Resend.

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

`migrate deploy` "All migrations have been successfully applied" demeli, `db:seed` hata vermeden bitmeli. Seed sahte hesap oluşturmaz, yalnızca bayiler, araçlar, SSS ve kurlar.
`.env` dosyana dokunulmadı; yerel veritabanın aynı kalır. (Adres PowerShell geçmişine yazılmış olabilir; işin bitince Neon'da parolayı yenileyebilirsin: Connect → Reset password.)

Neon panelinde **Tables** sekmesinde `Branch`, `Vehicle` vb. tabloları ve içlerinde satırları görmelisin.

## 3. Resend: e-posta (isteğe bağlı, sonra da yapılabilir)

E-posta ayarı olmadan site çalışır; "Şifremi unuttum" bağlantısı gönderilmez (canlıda log'a da yazılmaz).

1. resend.com → Sign up → **API Keys** → Create (izin: *Sending access*). Anahtarı kopyala.
2. Kendi alan adın varsa **Domains** → ekle ve istenen DNS kayıtlarını gir; sonra `MAIL_FROM` = `Novera Mobility <noreply@senin-alan-adin>`.
3. Alan adın yoksa: `MAIL_FROM` = `Novera Mobility <onboarding@resend.dev>` ve e-posta **yalnızca Resend'e kayıt olduğun adrese** gider. Demo için yeter.

## 4. Render: API

1. render.com → Sign up (GitHub ile) → **New → Blueprint** → `Novera-Mobility` deposunu seç. Render kökteki `render.yaml` dosyasını okur.
2. Sorduğu değerler:
   - `DATABASE_URL`: Neon adresi (1. adım).
   - `WEB_URL`: şimdilik `https://novera-mobility.vercel.app` yaz (Vercel'in vereceği adres farklıysa 6. adımda düzeltiriz).
   - `RESEND_API_KEY`, `MAIL_FROM`: 3. adımdaki değerler, e-posta istemiyorsan boş bırak.
   - `API_ACCESS_KEY` sorulmaz, Render kendisi üretir.
3. **Apply**. İlk kurulum birkaç dakika sürer. Günlükte (Logs) en sonda `Your service is live` görmelisin.

Doğru mu? Servisin adresi `https://novera-api-xxxx.onrender.com` gibi olur (bunu not al, `API_URL` olacak).
- Tarayıcıda `…/health` aç: `{"status":"ok"}` görünmeli.
- Tarayıcıda `…/branches` aç: `{"code":"NOT_FOUND",...}` görünmeli. **Bu doğru ve istenen sonuç**: anahtarı olmayan kimse API'yi kullanamaz.

Sorun çıkarsa:
- Günlükte `pnpm: command not found`: Render → servis → **Settings → Build Command** içinde `corepack enable` yerine `npm install -g pnpm@10.28.0` yaz, **Manual Deploy**.
- `The API cannot start in production: ...` hatası eksik değeri söyler (ör. `WEB_URL` ya da `DATABASE_URL`). **Environment** sekmesinden düzelt.
- Blueprint `plan: free` için hata verirse servisi panelden elle oluştur (New → Web Service), aynı komutları ve değişkenleri `render.yaml`'dan kopyala.

## 5. Vercel: web

1. vercel.com → Sign up (GitHub) → **Add New → Project** → `Novera-Mobility`.
2. **Root Directory**: `apps/web` (Edit'e basıp seç). Framework otomatik "Next.js" seçilir.
3. **Environment Variables** (hepsi Production):
   - `API_URL` = Render adresi (4. adım, sonunda `/` olmasın).
   - `API_ACCESS_KEY` = Render → `novera-api` → **Environment** → `API_ACCESS_KEY` → göz simgesiyle göster, kopyala.
   - `NEXT_PUBLIC_SITE_URL` = bu projenin Vercel adresi (ilk deploy'dan sonra öğrenirsin, sonra eklenir/değişir).
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = harita anahtarın. **Google Cloud'da anahtarı siteye kısıtla** (HTTP referrer: Vercel adresin), yoksa başkası kullanıp faturanı şişirebilir.
   - `USE_MOCKS` **ekleme** (boş kalsın; canlıda örnek veri kapalı olmalı).
   - Analytics değerleri boş kalsın.
4. **Deploy**. Bitince Vercel sana adres verir (`https://....vercel.app`).
5. İlk deploy'dan sonra: `NEXT_PUBLIC_SITE_URL`'i bu adresle düzelt, **Redeploy**.

## 6. Adresleri birbirine tanıt

Render → `novera-api` → **Environment** → `WEB_URL` = Vercel adresi (`https://....vercel.app`, sonunda `/` olmasın) → kaydet (otomatik yeniden başlar).

## 7. UptimeRobot: API'nin uyumaması için

uptimerobot.com → Sign up → **Add New Monitor** → tür **HTTP(s)**, adres `https://<render-adresi>/health`, aralık **5 dakika**. Bu olmadan API 15 dakikada uyur ve ziyaretçinin ilk isteği ~1 dakika bekler (Vercel'in 10 saniyelik sınırı yüzünden "hizmet kullanılamıyor" görünür).

## 8. Canlı deneme (SPEC §8 akışı)

Vercel adresinde sırayla: ana sayfa açılıyor mu → araç ara → sonuç listesi → **Kirala** → özet (geri sayım) → kayıt ol → rezervasyon yap → **Hesabım**'da rezervasyon görünüyor mu → iptal et → çıkış yap → tekrar giriş yap. Sonra "Şifremi unuttum": e-posta geliyor mu (3. adımı yaptıysan).

Güvenlik kontrolleri (PowerShell):

```powershell
# Anahtarsız istek reddedilmeli: 404
try { Invoke-WebRequest https://<render-adresi>/branches } catch { $_.Exception.Response.StatusCode.value__ }
# Swagger sayfası kapalı olmalı: 404
try { Invoke-WebRequest https://<render-adresi>/docs } catch { $_.Exception.Response.StatusCode.value__ }
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
- Geri yükleme denemesi yapılmamış yedek, yedek sayılmaz: bir kez boş bir Neon projesine `pg_restore` ile yüklemeyi dene.

## 10. Kendi alan adın olunca

Vercel → **Settings → Domains** → alan adını ekle ve DNS kayıtlarını gir. Sonra: Vercel `NEXT_PUBLIC_SITE_URL`, Render `WEB_URL` ve Resend alan adı yeni adrese çevrilir. Çerezler yeni adreste yeniden başlar (herkes bir kez giriş yapar).

## Sorun giderme

| Belirti | Sebep ve çözüm |
|---------|----------------|
| Sitede her şey "hizmet kullanılamıyor" | Render uykuda (7. adım) ya da `API_URL` yanlış. Render `/health` adresini aç. |
| Giriş/kayıt "kullanılamıyor" ama `/health` çalışıyor | `API_ACCESS_KEY` Vercel'de ve Render'da farklı. Render'dakini yeniden kopyala, Vercel'i **Redeploy** et. |
| Çok kişi aynı anda "çok fazla istek" alıyor | Ziyaretçi adresi API'ye ulaşmıyor: web yaması (`web-patch.md`) eksik ya da `TRUST_PROXY_HOPS` yanlış. |
| Giriş yapınca hemen çıkış oluyor | Çerez `Secure` ve site `http` üzerinden açılıyor. Canlıda her zaman `https` kullan. |
| Parola sıfırlama e-postası gelmiyor | `RESEND_API_KEY`/`MAIL_FROM` boş ya da alan adı doğrulanmamış. Render günlüğünde `The mail provider answered 4xx` satırına bak (e-posta adresi günlüğe yazılmaz). |
| İlk istek yavaş | Neon uykudan uyanıyor (birkaç yüz ms); normal. |
