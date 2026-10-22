# V2-10 · Oturum ve parola güvenliği

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-09
**Bulgular:** QUALITY G-12, G-13, G-14, G-15, V-06 · SECURITY.md "Karar bekleyenler" 1 ve 2

## Amaç
Parola özetini güncel önerilere çıkarmak, oturumlara boşta kalma süresi getirmek, süresi dolan kayıtları temizlemek ve SECURITY.md'deki iki açık kararı kapatmak.

## Kapsam
- **Parola özeti:**
  - scrypt N=2^17 (r=8, p=1). Özet biçimi parametreleri taşır.
  - Eski parametreli özet, başarılı girişte yenisiyle değiştirilir.
- **Parola kuralı:** 8–128 karakter ve yaygın parolalar listesine karşı denetim. Liste küçük bir dosyadır (en yaygın ~10.000 parola) ve repoya girer. Ret kodu `PASSWORD_TOO_COMMON`.
- **Oturum:**
  - `Session.lastUsedAt` eklenir.
  - Müşteride boşta kalma süresi 7 gün, mutlak süre 30 gün. `lastUsedAt` en çok 5 dakikada bir güncellenir.
  - Yönetici süreleri V2-23'te gelir.
- **Temizlik:** süresi dolan oturumları ve sıfırlama bağlantılarını silen günlük bir görev. Mevcut `@@index([expiresAt])` bu görevde kullanılır.
- **Hesap silmede doğrulama:**
  - `DELETE /me` parolalı hesapta `currentPassword` ister; yanlışsa `422 INVALID_PASSWORD`.
  - Parolasız (yalnız Google) hesapta kullanıcı e-posta adresini yazarak onaylar (`confirmEmail`).
  - Web'deki hesap silme penceresine alan eklenir.
- **Giriş kilidinin yumuşatılması:**
  - E-posta başına sınır aşılınca hesap kilitlenmez; artan bekleme uygulanır (1, 2, 4… en çok 15 dakika).
  - Doğru parola beklemeyi sıfırlar ama bekleme süresi içinde gelen deneme yine reddedilir.
  - Cevap hesabın varlığını sızdırmaz.

## Teknik notlar
- Kod: `apps/api/src/auth/password.ts:8`, `session-token.ts:4`, `auth.service.ts:111-114`, `session.guard.ts`, `me.controller.ts`.
- Web: `components/profile/*` (hesap silme), `lib/account-actions.ts`.
- `openapi.yaml`: `DELETE /me` gövdesi ve yeni kodlar.

## Kabul kriterleri
- [ ] Yeni özetler N=2^17. Eski özetli kullanıcı giriş yapınca özeti güncellenir (test).
- [ ] Yaygın bir parola (ör. `password123`) kayıtta ve parola değiştirmede reddedilir.
- [ ] 7 gün kullanılmayan oturum geçersizdir (test).
- [ ] Temizlik görevi süresi dolan kayıtları siler (test).
- [ ] Yanlış parolayla hesap silinmez; doğru parolayla silinir (e2e).
- [ ] E-posta başına sınır kilit yerine artan bekleme uygular.
- [ ] SECURITY.md "Karar bekleyenler" 1 ve 2 "kapandı" notuyla güncel; QUALITY'de G-12–G-15 ve V-06 güncel.

## Etiketler
`faz-2` `temel` `guvenlik` `P1` `api` `web`
