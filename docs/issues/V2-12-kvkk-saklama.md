# V2-12 · KVKK saklama süresi ve hesap silmede anonimleştirme

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-11 · **Karar:** SPEC §7 saklama süresi (öneri 2 yıl)
**Bulgular:** QUALITY V-07

## Amaç
Bugün iletişim mesajları ve teklif talepleri süresiz saklanıyor. Hesap silinince de teklif talebinde e-posta ve telefon kalıyor. Kişisel veriyi yalnızca gerektiği kadar tutmak.

## Kapsam
- **Saklama süresi:** `ContactMessage` ve `QuoteRequest` için saklama süresi (G'nin kararı) dolunca kişisel alanlar anonimleştirilir:
  - ad → "Silindi";
  - e-posta, telefon, mesaj metni → boş;
  - firma adı kalır.
  - Bunu günlük bir görev yapar. Kayıt istatistik için durur.
- **Hesap silme:** hesap silinince kullanıcının teklif taleplerindeki kişisel alanlar hemen anonimleşir. Rezervasyonlar için bugünkü davranış korunur ve belgelenir.
- **Hukuki metinler:** KVKK aydınlatma metni (`messages/*/legal.json`) saklama süresini yazar.
- **Belge:** SECURITY.md'ye "Veri saklama" bölümü eklenir: hangi tablo, ne kadar süre, nasıl siliniyor.

## Teknik notlar
Kod: `apps/api/prisma/schema.prisma:369-403`, hesap silme (`me.controller.ts`, `account-security.service.ts`), zamanlanmış görev altyapısı (kur güncellemesi zaten bir görev; aynı desen kullanılır).

## Kabul kriterleri
- [ ] Süresi dolan mesaj ve teklif görevle anonimleşir (test, sabit saatle).
- [ ] Silinen hesabın teklifinde e-posta ve telefon kalmaz (test).
- [ ] KVKK metni iki dilde güncel.
- [ ] SECURITY.md "Veri saklama" bölümü var.
- [ ] QUALITY'de V-07 güncel.

## Etiketler
`faz-2` `temel` `guvenlik` `P1` `api` `web` `veritabani`
