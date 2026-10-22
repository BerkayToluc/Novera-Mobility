# V2-07 · API doğrulaması zod ile tek yöntem

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** L · **Bağımlı:** Faz 1 (V2-02 – V2-06)
**Bulgular:** QUALITY G-09 · **Mimari:** ADR-26

## Amaç
Bugün API'de doğrulama dört ayrı yerde elle yazılmış. Global `ValidationPipe` hiçbir şey yapmıyor ve kurallar `@ApiBody`'de bir kez daha tekrarlanıyor. Hedef, her ucun girdisinin tek bir yöntemle doğrulanması. Panel ve Filom 30'dan fazla yeni uç getirecek; hepsi bu düzenle yazılacak.

## Kapsam
- `common/zod-validation.pipe.ts`:
  - zod hatasını ADR-17 biçimine çevirir: `422 VALIDATION_FAILED` + `fieldErrors`;
  - alan kodları bugünkülerle aynı kalır: `REQUIRED`, `INVALID_FORMAT`, `NOT_IN_SLOT`, `OUT_OF_RANGE`, `IN_PAST`...
- Mevcut uçların gövde, sorgu ve yol parametreleri için `src/<alan>/<alan>.schemas.ts` dosyaları. Kapsanan alanlar: auth, me, holds, reservations, price, forms (contact, quotes), catalog sorguları.
- Taşınıp kaldırılacak el yazısı doğrulayıcılar:
  - `FormReader`;
  - `parseReservationRequest`;
  - `HoldsService.validate`;
  - catalog sorgu ayrıştırma.
- `class-validator`, `class-transformer` ve etkisiz global `ValidationPipe` kaldırılır. `configureApp` testlerde de aynı pipe'ı kurar.
- **OpenAPI:**
  - Gövde şemaları mümkünse zod'dan üretilir.
  - Mümkün değilse bir sözleşme testi şema ile `openapi.yaml`'ın aynı alanları ve zorunlulukları taşıdığını denetler.
- Bilinmeyen alanlar sessizce atılır (`strip`). Kimlik, rol, `userId` gibi alanlar gövdeden asla okunmaz.

## Kapsam dışı
Davranış değişikliği. Hata kodları ve cevaplar aynı kalır. Tek istisna: önceden 500 veren bozuk girdi artık 422 döner.

## Teknik notlar
- Kod: `apps/api/src/main.ts:15-21`, `app.setup.ts`, `forms/form-input.ts`, `reservations/reservation-input.ts`, `holds/holds.service.ts`, `catalog/catalog.service.ts`.
- Web'deki zod sürümüyle (4.x) aynı ana sürüm kullanılır.
- Büyük bir değişiklik olduğu için PR alan alan commit'lere bölünür.

## Kabul kriterleri
- [ ] Her controller ucunun girdisi bir zod şemasından geçer. `@Body() body: unknown` ile elle okuma kalmaz.
- [ ] `class-validator` ve `class-transformer` `package.json`'da yok.
- [ ] Mevcut HTTP testleri değişmeden geçer (aynı kodlar).
- [ ] Yeni HTTP testi: her uçta yanlış tipte alan (sayı yerine nesne vb.) 422 döner, 500 dönmez.
- [ ] `openapi.yaml` ile şemalar uyumlu (sözleşme testi ya da üretim).
- [ ] QUALITY'de G-09 güncel; ARCHITECTURE ADR-10 satırı "Değişti" notuyla güncel.

## Etiketler
`faz-2` `temel` `refactor` `P1` `api`
