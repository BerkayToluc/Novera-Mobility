# V2-04 · API production'da güvenli açılsın (fail-closed)

**Faz:** 1 · Acil güvenlik · **Öncelik:** P0 · **Boyut:** S · **Bağımlı:** V2-01
**Bulgular:** QUALITY G-03, G-07

## Amaç
Bugün yanlış yapılandırma sessizce açık veriyor:
- `API_ACCESS_KEY` yoksa API herkese açık çalışıyor.
- `NODE_ENV` unutulursa oturum çerezi `Secure` olmuyor, sıfırlama bağlantıları günlüğe düşüyor ve `/docs` açılıyor.

Hedef: yanlış yapılandırmada API hiç açılmasın.

## Kapsam
- **Anahtar kontrolü:** `assertRuntimeEnv` production'da `API_ACCESS_KEY`'i zorunlu tutar; en az 32 karakter olmalı. Değilse açılış hatası verir. Hata nedeni yazar, değeri yazmaz.
- **"Production mı?" kararı** tek bir yardımcıda verilir:
  - `NODE_ENV === 'production'` ise ya da `RENDER` gibi bir barındırıcı değişkeni varsa production sayılır.
  - Geliştirme modu yalnızca açıkça `NODE_ENV=development` verilince geçerlidir.
  - `NODE_ENV` tanımsızsa artık geliştirme sayılmaz; güvenli varsayılanlar uygulanır: çerez `Secure`, günlükte bağlantı yok, `/docs` kapalı.
- **Günlük:** sıfırlama bağlantısı ve e-posta adresi yalnızca açık geliştirme modunda günlüğe yazılır.
- **`.env.example`:** yorum bugün "production'da API anahtarsız çağrıyı reddeder" diyor. Bu iş bitince doğru olacak; açıklamalar buna göre düzeltilir.
- **SECURITY.md:** S9 satırına "V2-04 ile açılış kontrolü eklendi" notu düşülür.

## Teknik notlar
- Kod: `apps/api/src/config/runtime.ts:27-40`, `common/api-access.ts:25-27`, `auth/auth.controller.ts:14`, `auth/reset-link-notifier.ts:67`, `app.setup.ts`.
- Testler: `runtime.spec.ts`.

## Kabul kriterleri
- [ ] Production'da anahtarsız ya da 32 karakterden kısa anahtarla API açılmaz (test).
- [ ] `NODE_ENV` tanımsızken çerez `Secure`, `/docs` kapalı, günlükte bağlantı yok (test).
- [ ] `NODE_ENV=development` iken yerel geliştirme bugünkü gibi çalışır.
- [ ] Yeni sürüm Render'da sorunsuz açıldı (Berkay doğrular ve issue'ya yazar).
- [ ] QUALITY'de G-03 ve G-07 güncel.

## Etiketler
`faz-1` `guvenlik` `P0` `api`
