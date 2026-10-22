# V2-06 · Web: örnek veri modu tek yerde, production'da yasak; /api yönlendirmesi kalkar

**Faz:** 1 · Acil güvenlik · **Öncelik:** P0 · **Boyut:** M · **Bağımlı:** V2-01
**Bulgular:** QUALITY G-06, G-08, G-19, M-06 · **Mimari:** ADR-29

## Amaç
`USE_MOCKS` 23 dosyada farklı biçimlerde okunuyor ve `.env.example`'da değeri `1`. Bu değer üretime taşınırsa:
- ödeme öncesi giriş zorunluluğu atlanır;
- her kimlik bilgisi "giriş" yapar.

Ayrıca kullanılmayan `/api` yönlendirmesi API'yi web alan adından da erişilebilir kılıyor.

## Kapsam
- **Tek kaynak:** `apps/web/lib/mode.ts`, `dataMode(): 'api' | 'mock'`. Tüm `process.env.USE_MOCKS` okumaları ve dört ayrı `mocksEnabled()` bu modüle döner; öncelik her akışta aynıdır (ADR-29).
- **Production koruması:**
  - `VERCEL_ENV === 'production'` ya da `NODE_ENV === 'production'` iken `USE_MOCKS` doluysa `next build` ve sunucu açılışı anlaşılır bir hatayla durur.
  - CI'daki e2e ve link kontrolü build'i ayrı bir bayrakla (ör. `NOVERA_E2E=1`) çalışır ve bu kurala takılmaz.
- **Giriş koruması:** mock modunda da ödeme öncesi giriş zorunluluğu **açık** kalır. Mock'ta sahte giriş akışı kullanılır; koruma atlanmaz.
- **Mock verisi:** sunucu koduna yalnızca mock modunda dinamik `import()` ile girer.
- **`.env.example`:** `USE_MOCKS=` boş bırakılır; açıklama "yalnızca yerel ve test" olur.
- **`/api` yönlendirmesi:** `next.config.ts`'ten kaldırılır. ARCHITECTURE ADR-14 satırı zaten bunu söylüyor.
- **Depo hijyeni:** `.gitignore`'a `carPhotos/` eklenir.

## Teknik notlar
- Kod:
  - `apps/web/lib/account-actions.ts:21`, `account-server.ts:16`, `auth-actions.ts:24,110`, `fleet-client.ts:34`, `session.ts:4`;
  - `app/[locale]/odeme/actions.ts:58`, `odeme/page.tsx:38`;
  - `next.config.ts:30-35`, `playwright.config.ts`, `.github/workflows/ci.yml`.
- İş bitince `grep -rn "USE_MOCKS" apps/web` yalnızca `mode.ts` ile test yapılandırmasını bulmalı.

## Kabul kriterleri
- [ ] `USE_MOCKS=1 NODE_ENV=production pnpm --filter @novera/web build` hata verir; CI'daki e2e build'i geçer.
- [ ] `USE_MOCKS` yalnızca `lib/mode.ts`'te okunur.
- [ ] Mock modunda girişsiz `/odeme` giriş sayfasına yönlendirir (e2e).
- [ ] Web'de `/api/...` adresi 404 döner.
- [ ] `git status` artık `carPhotos/`'u göstermez.
- [ ] Tüm e2e testleri yeşil; QUALITY'de G-06, G-08, G-19 ve M-06 güncel.

## Etiketler
`faz-1` `guvenlik` `P0` `web` `ci`
