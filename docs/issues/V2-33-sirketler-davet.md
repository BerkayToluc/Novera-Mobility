# V2-33 · Company modeli, Şirketler ekranı ve kurumsal kullanıcı daveti

**Faz:** 6 · Şirketler · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-24
**Belgeler:** ADMIN.md §3.3 · FLEET.md §2, §5 · ARCHITECTURE ADR-25

## Amaç
Kurumsal hesap açmanın tek ve güvenli yolunu kurmak: Novera şirketi açar, kişiyi davet eder, kişi şifresini kendisi belirler. Bu iş Filom'un önkoşuludur.

## Kapsam
- **Veri modeli:**
  - Yeni `Company` tablosu: ad, vergi dairesi, şehir, telefon, satış temsilcisi (JSON), zaman damgaları.
  - Migration, mevcut kurumsal kullanıcıların firma alanlarını `Company`'ye taşır ve `User.companyId`'yi bağlar. Aynı firma adı tek şirkete iner.
  - `User`'daki eski firma alanları kaldırılır.
  - `GET /me` cevabının biçimi **değişmez**; firma alanları şirketten doldurulur.
- **API:**
  - `GET/POST /admin/companies`, `GET/PATCH /admin/companies/{id}`;
  - `POST /admin/companies/{id}/users`: e-posta, ad, soyad, ünvan.
- **Davet:**
  - parolasız `CORPORATE` hesap açılır ve şirkete bağlanır;
  - 7 gün geçerli şifre belirleme bağlantısı üretilir (sıfırlama altyapısı, ayrı tür ve metin);
  - davet e-postası TR/EN, Resend üzerinden;
  - aynı e-posta varsa `409 EMAIL_TAKEN`;
  - "daveti yeniden gönder" uç ve düğmesi (eski bağlantıyı geçersiz kılar).
- **Web:**
  - şifre belirleme sayfası mevcut `/sifre-sifirla/yeni` sayfasını davet metniyle kullanır (`?tur=davet`);
  - şifre belirlenince kullanıcı kurumsal sekmeli giriş sayfasına yönlendirilir.
- **Ekran:**
  - `/yonetim/sirketler`: liste, "Yeni şirket";
  - `/yonetim/sirketler/:id`: bilgiler, kullanıcılar (davet durumu: bekliyor / aktif), "Kullanıcı davet et".
- **KVKK:** davet e-postası metni ve kurumsal kullanıcı verisi aydınlatma metninde anlatılır (V2-36'daki personel bölümüyle birlikte gözden geçirilir).

## Kabul kriterleri
- [x] Migration sonrası mevcut kurumsal hesapların `GET /me` cevabı birebir aynı (test: önce/sonra anlık görüntüsü). _Nasıl: `companies.integration.spec.ts` migration SQL'inin `DATA MOVE` bloğunu çalıştırır, her hesabın `toUserResponse` çıktısını öncesi ve sonrasıyla karşılaştırır. Tek fark, issue'nun kendi kuralıdır: aynı ada sahip hesaplar firma bilgisinde ayrışıyorsa en eski hesabın bilgileri şirketin olur (ayrı testle belgelenmiş)._
- [x] Davet edilen kişi bağlantıyla şifre belirler ve kurumsal sekmeden girer (e2e mock + canlıda kendi adresiyle G denemesi). _Nasıl: gerçek veritabanıyla `companies.integration.spec.ts` daveti kabul edip `AuthService.login` ile girer; `e2e/admin-companies.spec.ts` davet sayfasını ve kurumsal sekmeye yönlendirmeyi sınar. **Canlıda kendi adresiyle deneme yapılmadı** (migration uygulanıp yayına çıkınca)._
- [x] 7 gün sonra bağlantı geçersiz; yeniden gönderilen davette eski bağlantı geçersiz (test). _Nasıl: `companies.integration.spec.ts` süresi dolmuş bağlantıyı ve yeniden gönderimden sonra eski bağlantıyı reddettirir._
- [x] Aynı e-posta `409`. _Nasıl: `companies.integration.spec.ts` (eşzamanlı iki davet dahil) ve `e2e/admin-companies.spec.ts`._
- [ ] Yetki testleri; işlem kaydı (`company.create`, `company.invite`); 375/1280 ekran görüntüsü.

## Etiketler
`faz-6` `ozellik` `P2` `api` `web` `veritabani`
