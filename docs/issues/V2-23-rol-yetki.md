# V2-23 · Yönetici rolü, AdminGuard, admin:create ve işlem kaydı

**Faz:** 3 · Panel temeli · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-22
**Belgeler:** ADMIN.md §2, §5, §6 · ARCHITECTURE ADR-24

## Amaç
Yönetim panelinin güvenlik temelini kurmak: kim yöneticidir, yönetici nasıl açılır, yöneticinin her değişikliği nasıl kayda geçer.

## Kapsam
- **Rol:** `User.role` (`CUSTOMER` varsayılan, `ADMIN`); migration ile eklenir. `GET /me` cevabına `role` eklenir.
- **`AdminGuard`:** oturum + `role = ADMIN`. Oturum yoksa `401`, rol yoksa `403 FORBIDDEN`. `/admin/*` önüne global olarak bağlanır.
- **`pnpm admin:create`:**
  - `--email`, `--name` alır; parolayı terminalden gizli olarak sorar;
  - en az 12 karakter ve yaygın parola denetimi;
  - var olan hesaba rol verir ya da yeni hesap açar;
  - `--revoke` rolü alır ve açık oturumları kapatır.
- **Yönetici oturumu:**
  - mutlak süre 12 saat, boşta kalma süresi 1 saat (V2-10 altyapısıyla);
  - yönetici hesabında Google ile giriş `403 GOOGLE_NOT_ALLOWED`.
- **`AuditLog` tablosu ve yazıcısı:**
  - `id, at, actorId, companyId?, action, entity, entityId, fields String[]`;
  - bir dekoratör ya da servis, değiştiren isteklerde kayıt yazar;
  - değer yazılmaz; tablo yalnızca eklemeye açıktır (servis güncelleme ve silme sunmaz).
- **Ek kurallar:**
  - `/admin/*` değiştiren uçlarda JSON dışı içerik türü `415`;
  - hız sınırı anahtarı `admin:<id>`, dakikada 120.
- **Web:** giriş yapan kullanıcının rolü oturum nesnesinde (`getSession`) bulunur. Hesap menüsüne yalnızca yöneticide "Yönetim paneli" bağlantısı eklenir (sayfa V2-24'te).

## Teknik notlar
- Dosyalar: `apps/api/src/auth/session.guard.ts`, `user-view.ts`, yeni `src/admin/` (guard, audit), `package.json` betiği (`admin:create`), `prisma/schema.prisma`.
- `openapi.yaml`: `role`, yeni hata kodları, `/admin` güvenlik şeması.
- SECURITY.md'ye "Yönetim paneli" bölümü eklenir.

## Kabul kriterleri
- [ ] Bir deneme ucu (`GET /admin/ping` ya da `GET /admin/summary` iskeleti) için oturumsuz 401, müşteri 403, yönetici 200 testleri.
- [ ] `admin:create` yerelde ve Neon'da çalıştı; parola terminal geçmişine düşmedi (Berkay doğrular).
- [ ] Yönetici oturumu 12 saat sonra geçersiz (test, sabit saat).
- [ ] Yöneticiyle Google girişi 403.
- [ ] Değiştiren deneme isteği `AuditLog`'a alan adlarıyla yazıldı; değer yok (test).
- [ ] SECURITY.md bölümü yazıldı.

## Etiketler
`faz-3` `ozellik` `guvenlik` `P2` `api` `web` `veritabani`
