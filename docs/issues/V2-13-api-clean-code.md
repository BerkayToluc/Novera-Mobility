# V2-13 · API clean code: ortak modül, kopyalar, yapılandırma

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** L · **Bağımlı:** V2-07
**Bulgular:** QUALITY M-01, M-02, M-03, M-04, V-10

## Amaç
Panel ve Filom'un yeni modülleri yazılmadan önce ortak yardımcıları tek yere toplamak, kopyaları kaldırmak ve yapılandırmayı tipli hale getirmek. Davranış değişmez.

## Kapsam
- **`src/common/`'a taşınacak ve tekleştirilecek yardımcılar:**
  - `clientKeyOf` ve hız sınırı (V2-09'da yapılmadıysa);
  - UUID ve 30 dakikalık dilim kontrolü;
  - `isUniqueViolation`, `validationFailed`;
  - zaman sabitleri (`HOUR_MS`, `DAY_MS`);
  - rezervasyon/tutma çakışma kuralı (tek SQL parçası ya da tek fonksiyon);
  - `getRate` ve `toMoney`;
  - isteğe bağlı oturum okuma.
- **Parola sınırları:** `PASSWORD_MIN` ve `PASSWORD_MAX` tek bir yerde.
- **Tipli yapılandırma:** tek `config/env.ts`. Ya zod ile doğrulanmış `ConfigModule` ya da tek bir okuma modülü. `process.env` başka hiçbir dosyada okunmaz.
- **İskelet artıkları:**
  - `GET /` "Hello World" (`app.controller.ts`, `app.service.ts`) ve eski `test/app.e2e-spec.ts` kalkar;
  - kullanılmayan `@nestjs/mau` kalkar.
- **Tip ve biçim:**
  - `catalog.service.ts:135,299`'daki `any` kalkar;
  - `tx as unknown as …` dönüşümleri yerine Prisma işlem tipi kullanılır;
  - eksik `.js` uzantıları eklenir;
  - Prettier ayarı tek tip olur ve tüm `apps/api`'ye bir kez uygulanır (ayrı bir commit).
- **Uzun dosyalar:** `catalog.service.ts` müsaitlik ve katalog okuma olarak bölünür. 375 satırı aşan spec'lerin ortak kurulumları `*.testing.ts` yardımcılarına çıkar.
- **Kur güncellemesi:**
  - `FALLBACK_RATES` tek yerde tanımlanır.
  - ±%50 sıçrama koruması, art arda üç gün aynı yönde gelen değeri kabul edecek şekilde değişir; reddedilen değer günlüğe yazılır.

## Kapsam dışı
Yeni özellik; uç adı ya da cevap değişikliği.

## Teknik notlar
Klasörler: `apps/api/src/holds`, `reservations`, `catalog`, `forms`, `auth`, `config`. Taşımalar mekaniktir; her taşıma ayrı bir commit olur ki inceleme kolay olsun.

## Kabul kriterleri
- [ ] QUALITY M-01'deki kopyaların her biri tek tanıma iner (`grep` çıktısı PR'da).
- [ ] `process.env` yalnızca yapılandırma modülünde okunur.
- [ ] `any` yok; `GET /` 404 döner.
- [ ] Tüm testler değişmeden yeşil; e2e yeşil.
- [ ] Kur koruması testi: büyük ama kalıcı bir hareket üçüncü gün kabul edilir.
- [ ] QUALITY'de M-01–M-04 ve V-10 güncel.

## Etiketler
`faz-2` `temel` `refactor` `P1` `api`
