# V2-19 · Test boşlukları: gerçek API'ye karşı e2e, axe, eksik API testleri

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** L · **Bağımlı:** V2-11
**Bulgular:** QUALITY T-01, T-02, T-03

## Amaç
Bugün uçtan uca testler yalnızca örnek veriyle çalışıyor; gerçek API kod yolu hiç denenmiyor. Erişilebilirlik ise testte ölçülmüyor. Hedef: v2'nin büyük değişikliklerinde gerilemeyi CI yakalasın.

## Kapsam
- **Gerçek API'ye karşı smoke:**
  - CI'da API, test veritabanıyla (migrate + seed) ayağa kalkar.
  - Web, `USE_MOCKS` olmadan ve `API_URL` ile build edilip başlatılır.
  - Yeni bir Playwright projesi (`smoke-api`) şu akışı koşar: kayıt → arama → Kirala → özet → ödeme → onay → Rezervasyonlarım'da görünür → iptal (SPEC §6 madde 1'in çekirdeği).
  - Yalnızca 1280 px; süre hedefi 3 dakikanın altı.
- **axe:** `@axe-core/playwright` ile her e2e sayfasında WCAG 2.2 AA taraması yapan bir yardımcı; ihlalde test kırmızı olur. Mevcut testlere yardımcı çağrısı eklenir.
- **Eksik API testleri:**
  - katalog: bayiler, modeller, ek hizmetler, kurlar;
  - `device.ts`, `user-view.ts`;
  - doğrulama pipe'ının HTTP davranışı;
  - geçmiş tarihli rezervasyon regresyonu (V2-02'de yazıldıysa işaretlenir).
- **Test kuralı:** WORKFLOW ve QUALITY §4'teki kural ("yeni uç = birim + HTTP testi; yeni ekran = en az bir e2e") CLAUDE.md'ye de yazılır.

## Teknik notlar
Dosyalar: `apps/web/playwright.config.ts`, `apps/web/e2e/`, `.github/workflows/ci.yml`, `apps/api/src/**/*.spec.ts`. Smoke projesi mock projesinden ayrı çalışır ve CI'da ayrı bir adımdır.

## Kabul kriterleri
- [ ] CI'da `smoke-api` adımı yeşil; API bilerek kapatılınca kırmızı.
- [ ] axe yardımcısı tüm e2e sayfalarında çalışır; bilerek bozulan bir kontrast testi kırmızı yapar.
- [ ] Listelenen API alanlarında testler var.
- [ ] QUALITY'de T-01–T-03 güncel.

## Etiketler
`faz-2` `temel` `test` `ci` `P1` `api` `web`
