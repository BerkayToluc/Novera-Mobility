# V2-36 · Filom kabuğu: Özet, Araçlar, Personel, Zimmet, Sözleşmeler

**Faz:** 7 · Filom temeli · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-35
**Belgeler:** FLEET.md §2, §3, §3.1, §6 · DESIGN.md §8 · SPEC §3.C

## Amaç
Akıllı Kurumsal Filo'daki "Tek ekranda yönetim" vaadinin ilk çalışan hâli: kurumsal müşteri filosunu, personelini ve zimmetlerini Filom'da yönetir.

## Kapsam
- **Rotalar:** `app/[locale]/filom/layout.tsx` (EN `/en/my-fleet`).
  - Sunucuda oturum ve şirket kontrolü: bireysel hesapta `notFound()`, girişsiz kullanıcı girişe.
  - Sözleşmesi olmayan şirkette boş durum ve teklif çağrısı (`/kurumsal-teklif`).
  - Tüm sayfalar `noindex`.
- **Giriş noktaları:** hesap menüsünde ve kurumsal profilde, yalnızca sözleşmeli şirkette "Filom" bağlantısı.
- **Ekranlar (V2-24 bileşenleriyle):**
  - Özet;
  - Araçlar (liste + `/filom/araclar/:plaka` detay);
  - Personel (ekle, düzenle, pasifleştir);
  - Zimmet (araç detayında ver/geri al ve `/filom/zimmet` geçmişi);
  - Sözleşmeler (liste + detay; yenileme talebi V2-38'de).
- **Metinler:** `messages/tr|en/fleet-panel.json`. Tutarlar ₺ ve "Tutarlar TL" notu.
- **Öncelikli genişlik 375 px:** tablolar dar ekranda kart listesine döner ya da yatay kayar (DESIGN.md §8).
- **KVKK:** aydınlatma metnine "kurumsal müşterinin personel bilgileri" bölümü (`legal.json`, TR/EN). **Metni G onaylar.**

## Kabul kriterleri
- [x] e2e: kurumsal giriş → Filom Özet → araç detayı → personele ver → detayda zimmet ve geçmiş → geri al. _Nasıl: `e2e/fleet-panel.spec.ts` (giriş formundan profil → "Filom" → özet sayıları ve listeleri; araç ver ve geri al, geçmiş iki kayıt tutar; zimmetli araçta ver formu yok)._
- [x] Bireysel hesap `/filom`'da 404; sözleşmesi olmayan kurumsal hesapta boş durum (e2e). _Nasıl: `e2e/fleet-panel.spec.ts` bireysel ve yönetici hesabı için `/filom` altında 404, girişsiz ziyaretçi `?sonra=filom` ile kurumsal girişe, sözleşmesiz hesapta boş durum ve teklif bağlantısı (menü yok); `fleet.integration.spec.ts` `hasFleet`'in gerçek veritabanında doğru olduğunu sınar._
- [x] Personel pasifleştirilince açık zimmeti kapanır (test). _Nasıl: `fleet.integration.spec.ts` (V2-35) gerçek veritabanında; `e2e/fleet-panel.spec.ts` ekranda (onay penceresi aracı söyler, sonra araç boşta, açık zimmet kalmaz)._
- [x] 375/768/1280 taşma yok; axe temiz; ~~ekran görüntüleri~~. _Nasıl: her e2e testi sayfanın axe denetimiyle biter (mobil 375 ve masaüstü 1280 projeleri); ekran görüntüsü artık istenmiyor (Berkay, 31 Ekim)._
- [x] KVKK bölümü yazıldı (`legal.json`, TR/EN). _Onay: metni Berkay onaylar (G'nin onayı artık gerekmiyor); PR'ın birleşmesi onay yerine geçer._

## Etiketler
`faz-7` `ozellik` `P2` `web` `api`
