# V2-34 · Yönetim > Kullanıcılar (hesap kapatma) ve İşlem kaydı ekranı

**Faz:** 6 · Şirketler · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-33
**Belgeler:** ADMIN.md §3, §3.3, §4

## Amaç
Kötüye kullanılan bir hesabı kapatabilmek ve panelde kimin neyi değiştirdiğini görebilmek (G, 22 Ekim: "kayıt + hesap kapatma").

## Kapsam
- **Veri modeli:** `User.disabledAt`.
- **API:**
  - `GET /admin/users`: e-posta veya ad araması; tür ve durum süzgeci; sayfalı.
  - `GET /admin/users/{id}`: rezervasyon sayısı, puan, şirket.
  - `POST /admin/users/{id}/disable` ve `/enable`.
- **Hesap kapatma kuralları:**
  - tüm oturumlar silinir;
  - parola ve Google girişi `401 INVALID_CREDENTIALS` döner (durum sızmaz);
  - yönetici kendini ya da başka bir yöneticiyi kapatamaz (`403`);
  - gelecek rezervasyonlar iptal edilmez, sayısı ekranda gösterilir.
- **İşlem kaydı:** `GET /admin/audit-log`; yönetici, alan (`entity`) ve tarih aralığı süzgeci. Salt okunur.
- **Ekranlar:**
  - `/yonetim/kullanicilar`: liste, detay, kapat/aç onayı;
  - `/yonetim/kayit`: tablo; satırda kim, ne zaman, ne yaptı, hangi kayıt, hangi alanlar.

## Kabul kriterleri
- [x] Kapatılan hesap parola ve Google ile giremez; açık oturumu düşer (test). _Nasıl: `users.integration.spec.ts` (gerçek veritabanı): parola cevabı yanlış parolayla birebir aynı `401 INVALID_CREDENTIALS`, bağlı ve bağlanacak Google hesabı reddedilir (bağlanmaz), oturum silinir, sonradan eklenen oturum geçersiz sayılır, şifre sıfırlama bağlantısı gitmez ve işe yaramaz._
- [x] Yönetici kendini kapatamaz. _Nasıl: `users.integration.spec.ts` yönetici hesabı için `403 FORBIDDEN`, hesap ve oturumu değişmez; HTTP testlerinde müşteri `403`._
- [x] Yeniden açılan hesap girebilir. _Nasıl: `users.integration.spec.ts` (parola ve Google), `e2e/admin-users.spec.ts` (örnek giriş)._
- [x] İşlem kaydı süzgeçleri çalışır; kayıt düzenlenemez (uç yok). _Nasıl: `audit-log.integration.spec.ts` yönetici, tür ve gün süzgeçlerini (İstanbul gün sınırı dahil), sayfalamayı ve veritabanının güncelleme/silmeyi reddettiğini; `admin.http.spec.ts` `POST/PUT/PATCH/DELETE /admin/audit-log` için `404`._
- [x] e2e: kullanıcı kapat → giriş reddi (mock); kayıtta görünür. _Nasıl: `e2e/admin-users.spec.ts` (kapat → "E-posta veya şifre hatalı" → yeniden aç → girer; `user.disable` kayıtta)._
- [ ] 375/1280 ekran görüntüsü; axe temiz.

## Etiketler
`faz-6` `ozellik` `guvenlik` `P2` `api` `web`
