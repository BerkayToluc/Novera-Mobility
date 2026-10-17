# Güvenlik gözden geçirmesi (BACKLOG 39, issue #48)

Tarih: 17 Ekim 2026. Kapsam: `apps/api` kodu, `docs/api/openapi.yaml` sözleşmesi ve web'in API'yi çağırma şekli
(`apps/web/lib/api-post.ts`, `api-request.ts`, `next.config.ts`). Yöntem: kodun satır satır okunması,
yeni testler ve `pnpm audit`.

## Bu PR'da düzeltilenler

| # | Seviye | Bulgu | Düzeltme |
|---|--------|-------|----------|
| S1 | Yüksek | İstemci kimliği `X-Forwarded-For` başlığının **ilk** girdisinden alınıyordu. Bu girdiyi ziyaretçi yazar; her istekte değiştirerek giriş (10/15 dk), kayıt, parola sıfırlama, form ve **araç tutma (istemci başına 5)** sınırları aşılabiliyordu. Aynı işlev `holds.controller.ts` içinde ikinci kez kopyalanmıştı. | Kimlik artık `request.ip`. Express, başlığı yalnızca `TRUST_PROXY_HOPS` kadar proxy'ye güvenerek çözer (varsayılan 1: Next). Tek ortak `clientKeyOf` kullanılır. |
| S2 | Orta | Bellek içi hız sınırlayıcı yalnızca 24 saatten eski kayıtları siliyordu; uydurma anahtarlarla sınırsız büyüyebilirdi (bellek tükenmesi). | Tablo 10.000 anahtarla sınırlı; dolunca en az kullanılan anahtarlar silinir. |
| S3 | Orta | Hata yanıtı biçimi tutarsızdı: bilinmeyen yol, bozuk JSON, büyük gövde sözleşme dışı (`statusCode`, ayrıştırıcı metni) dönüyordu. Beklenmeyen hatalarda ayrıntı sızma riski. | Genel hata filtresi: her hata `{code, message, fieldErrors?}`. Beklenmeyen hata `500 INTERNAL_ERROR` ve sabit metin; ayrıntı yalnızca sunucu günlüğüne (yol ve yöntem, sorgu ve gövde yazılmaz). Yeni kodlar: `PAYLOAD_TOO_LARGE`, `INTERNAL_ERROR`. |
| S4 | Düşük | Swagger sayfası (`/docs`) canlıda da açıktı ve tüm uçları listeliyordu. | Canlıda kapalı; `ENABLE_DOCS=1` ile açılır. |
| S5 | Düşük | Güvenlik başlıkları yoktu; `X-Powered-By` çerçeveyi bildiriyordu; kişiye ait yanıtlar (`/me`, `/auth`, `/reservations`, `/holds`) önbelleğe alınabilirdi. | `nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, kişisel yollarda `Cache-Control: no-store`, `X-Powered-By` kapalı. |
| S6 | Orta | Canlıda `WEB_URL` unutulursa parola sıfırlama bağlantıları `http://localhost:3000` adresine giderdi. | Canlıda `DATABASE_URL` ve `https://` ile başlayan `WEB_URL` yoksa sunucu açılmaz, nedeni yazar. Geçersiz `TRUST_PROXY_HOPS` her ortamda açılışı durdurur. |
| S7 | Düşük | SIGTERM'de veritabanı bağlantısı düzgün kapanmıyordu. | `enableShutdownHooks()`. |
| S8 | Düşük | `.env.example` içinde anahtarsız, açıklamasız bir `http://localhost:3000` satırı vardı. | Açıklamaya çevrildi; yeni değişkenler eklendi. |

## İncelendi, sorun bulunmadı

- **SQL enjeksiyonu:** tüm ham sorgular etiketli şablon (`$queryRaw` + `${}`), parametre olarak gider; `Unsafe` kullanımı yok.
- **Parolalar:** scrypt, rastgele tuz, `timingSafeEqual`; olmayan e-postada sahte özetle doğrulama (süre farkı yok).
- **Oturum:** 256 bit rastgele anahtar, veritabanında yalnızca SHA-256 özeti; çerez `httpOnly`, `SameSite=Lax`, canlıda `Secure`. Parola değişince/sıfırlanınca diğer oturumlar ve sıfırlama bağlantıları silinir.
- **Parola sıfırlama:** bağlantı tek kullanımlık, özet saklanır, 1 saat; var olan/olmayan hesap aynı yanıtı verir.
- **Yetki (IDOR):** `/me/*`, iptal, oturum kapatma sorguları hep `userId` ile süzülür; başkasının kaydı 404.
- **Toplu atama:** profil güncellemesi alan alan beyaz listeyle okunur; e-posta ve rol değiştirilemez.
- **Eşzamanlılık:** araç ve (puanla ödemede) kullanıcı satırı kilidi; iki kilit hep aynı sırayla alınır.
- **Girdi:** kimlikler metin sütunu, uydurma kimlik hata değil 404/422 verir; gövde sınırı Express varsayılanı 100 KB (testle kanıtlandı: üstü `413`).
- **CORS:** gerekmiyor (ADR-14: tarayıcı Next üzerinden gelir). Eklenmedi; doğrudan erişim açılırsa yeniden bakılır.
- **CSRF:** `SameSite=Lax` + yalnızca JSON gövdeli POST/PATCH/DELETE. Çapraz site isteğine çerez eklenmez. Kodda tarayıcıdan `/api` çağrısı bulunmadı; tüm çağrılar sunucudan gidiyor.
- **Bağımlılıklar (`pnpm audit`):** üretim bağımlılıklarında 3 bulgu var (`mysql2` 2 adet, `deepmerge-ts` 1 adet); hepsi Prisma **komut satırı aracının** içinden geliyor, çalışan API'de kullanılmıyor (veritabanı sürücüsü `pg`). Geliştirme bağımlılığı `@nestjs/mau` içinde `undici` ve `tmp` bulguları var; canlıya girmez. Prisma ve Nest güncellemelerinde `pnpm audit` tekrar çalıştırılmalı.

## Karar bekleyenler (kodda değiştirilmedi)

1. **Hesap silme için parola istemek.** `DELETE /me` yalnızca oturum çerezine bakıyor; çalınmış bir oturum hesabı siler. Parola (`currentPassword`) istemek sözleşme ve ön yüz değişikliği gerektirir (G).
2. **Girişte hesap bazlı sınır:** biri bir e-postaya 10 yanlış deneme yaparak o kişinin girişini 15 dakika kilitleyebilir. Kaba kuvveti durdurmanın bedeli bu; ileride ek sınır ya da bekleme ile yumuşatılabilir.
3. **Parola sıfırlama isteği süre farkı:** hesap varsa veritabanı yazması olduğu için yanıt biraz geç gelir; ölçülerek hesap varlığı tahmin edilebilir (düşük risk, sınırlı).
4. **Kayıtta `EMAIL_TAKEN`:** hesap varlığını açık eder; sözleşmeye göre bilinçli (kullanıcıya doğru mesaj). Sınır: saatte 10 kayıt/istemci.
5. **Açık okuma uçlarına sınır yok** (`/vehicles`, `/reservations/price`, ...). Yayında CDN/yük dengeleyici düzeyinde istek sınırı eklenmesi önerilir.
6. **Bellek içi sınırlayıcı** tek sunucuda çalışır ve yeniden başlayınca sıfırlanır. Birden fazla API sunucusu çalıştırılırsa ortak bir depo (ör. Redis) gerekir.

## Yayın (BACKLOG 40, issue #49) için zorunlu kontrol listesi

- [ ] `NODE_ENV=production` (aksi halde oturum çerezi `Secure` olmaz).
- [ ] API portu internete **açık olmamalı**: yalnızca web sunucusu erişebilmeli (özel ağ, güvenlik duvarı ya da `HOST=127.0.0.1`). Doğrudan erişilebilen bir API'de `X-Forwarded-For` taklit edilebilir.
- [ ] `TRUST_PROXY_HOPS`, API'den önceki proxy sayısına eşit olmalı. Web'in sunucu eylemleri gelen `X-Forwarded-For` başlığını olduğu gibi API'ye iletir (`api-post.ts`, `api-request.ts`); web'in önünde başlığa gerçek adresi **ekleyen** bir yük dengeleyici varsa (Vercel, Cloudflare, nginx) varsayılan `1` doğrudur. Web doğrudan internete açıksa başlığı ziyaretçi yazar: önüne proxy konmalı. Zincir uzunsa (ör. Cloudflare → nginx → Next) değer büyütülür.
- [ ] `WEB_URL=https://...` ve `DATABASE_URL` tanımlı (yoksa API açılmaz).
- [ ] `/docs` kapalı kalmalı (`ENABLE_DOCS` boş).
- [ ] Parola sıfırlama bağlantıları için gerçek e-posta sağlayıcısı: canlıda bağlantı şimdilik yalnızca "istek geldi" uyarısı yazar, kimseye gitmez (`reset-link-notifier.ts`).
- [ ] Veritabanı yedeği ve geri yükleme denemesi; veritabanı parolası geliştirme değerinden (`novera_dev`) farklı olmalı.
- [ ] Web tarafı (G): CSP ve HSTS zaten var (`next.config.ts`, `proxy.ts`); canlı alan adında doğrulanmalı.
