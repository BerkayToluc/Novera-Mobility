# V2-28 · Fotoğraf yükleme altyapısı

**Faz:** 4 · Katalog · **Öncelik:** P2 · **Boyut:** M · **Bağımlı:** V2-24 · **Karar:** SPEC §7 depolama servisi (öneri Vercel Blob)
**Belgeler:** ARCHITECTURE ADR-28 · QUALITY §3.1 "Dosya"

## Amaç
Yöneticinin yeni araç modeline panelden fotoğraf yükleyebilmesi. Bunu güvenli biçimde yapmak: yalnızca resim kabul edilir, boyut sınırlıdır, anahtar sızmaz.

## Kapsam
- **Depolama servisi:** G'nin kararıyla (öneri Vercel Blob). Ücretsiz katman koşulları uygulama günü resmi sayfadan doğrulanır ve DEPLOY.md'ye tarihle yazılır.
- **Server action `uploadVehicleImage`:**
  1. Yönetici oturumunu API'ye sorarak doğrular (`GET /me` → `role`).
  2. Dosyanın türünü ilk baytlarından anlar; yalnızca JPEG, PNG ve WebP kabul edilir.
  3. Boyutu en çok 5 MB, genişliği en az 1200 px olmalı.
  4. EXIF verisini siler, en çok 2000 px genişliğe ölçekler ve WebP'ye çevirir (sharp).
  5. Rastgele bir adla depoya yazar ve adresi döner.
- **Anahtar:** `BLOB_READ_WRITE_TOKEN` (ya da seçilen servisin anahtarı) yalnızca web sunucusunda durur; `.env.example`'a boş eklenir.
- **Görsel kaynakları:** `next.config.ts` `images.remotePatterns` ve CSP `img-src` (`lib/csp.ts`) depo alan adıyla güncellenir.
- **API:** `imageUrl` alanı yalnızca izinli depo alan adını ya da `/images/` ile başlayan yolu kabul eder (zod şeması).
- **Bileşen:** `FileField` (V2-24) bu action'a bağlanır: önizleme, ilerleme, hata metinleri (tür, boyut, genişlik).
- **Silme:** yükleme yapılıp form kaydedilmezse kalan dosyayı temizleme v2'de yok; PR'da "kabul edildi" diye not edilir.

## Kabul kriterleri
- [ ] JPEG/PNG/WebP yüklenir; PDF'in uzantısı `.jpg` yapılınca reddedilir (test).
- [ ] 5 MB üstü ve 1200 px altı reddedilir; hata metni iki dilde.
- [ ] Yüklenen dosyada EXIF yok (test).
- [ ] Müşteri oturumuyla action çağrılınca reddedilir.
- [ ] CSP ve görsel ayarları güncel; görsel önizlemede ve sitede yükleniyor.
- [ ] DEPLOY.md'de servis, anahtar ve koşul tarihi var.

## Etiketler
`faz-4` `ozellik` `guvenlik` `P2` `web` `api`
