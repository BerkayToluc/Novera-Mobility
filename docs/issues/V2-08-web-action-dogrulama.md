# V2-08 · Web server action'larında zod doğrulaması

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-06
**Bulgular:** QUALITY G-10, M-10 · **Mimari:** ADR-26

## Amaç
Bugün server action'ların çoğu `FormData`'dan gelen değeri doğrulamadan string metoduyla kullanıyor. Bu iki soruna yol açıyor:
- sahte bir istek 500 hatası üretiyor;
- sunucudaki kurallar tarayıcıdaki form şemalarından kayabiliyor.

## Kapsam
- Her server action ilk iş olarak `safeParse` yapar ve formun kullandığı şemayı yeniden kullanır. Şemalar `lib/*-schemas.ts` dosyalarında durur; eksik olanlar eklenir.
- Kapsanan action dosyaları: `auth-actions`, `contact-actions`, `quote-actions`, `password-reset-actions`, `account-actions`, `preferences-actions`, `odeme/actions`.
- Geçersiz girdi alan hatası olarak döner; formda alanın yanında görünür.
- Parola, e-posta ve ad kuralları tek bir yerde tanımlanır. `changePassword`'daki ayrı 8 karakter kuralı kalkar.
- Hata sınıfları düzeltilir: `AuthRateLimitedError`'ın mesajı genelleşir (giriş, kayıt, Google, sıfırlama) ya da her akışın kendi hata sınıfı olur.

## Teknik notlar
- Kod: `apps/web/lib/auth-actions.ts:96,128-134`, `contact-actions.ts:22-28`, `quote-actions.ts:21-27`, `password-reset-actions.ts:12,34`, `account-actions.ts:56`, `auth-client.ts:88`.
- Var olan şemalar: `auth-schemas.ts`, `profile-schemas.ts`, `payment-schema.ts`, `driver-schema.ts`.

## Kabul kriterleri
- [ ] Her server action girdisini bir zod şemasından geçirir.
- [ ] Birim test: her action'a sayı ya da nesne gibi yanlış tipte değer verilince alan hatası döner, istisna fırlatmaz.
- [ ] Parola kuralı tek bir sabit ya da şemada.
- [ ] Mevcut e2e testleri yeşil.
- [ ] QUALITY'de G-10 ve M-10 güncel.

## Etiketler
`faz-2` `temel` `guvenlik` `P1` `web`
