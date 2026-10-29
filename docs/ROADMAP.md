# Yol haritası (ROADMAP v2)

> Durum: **v2.0** · 22 Ekim 2026 · Sahip: G (PM). İşlerin tam listesi [BACKLOG.md](BACKLOG.md), kapsam [SPEC.md](SPEC.md), süreç [WORKFLOW.md](WORKFLOW.md).
> Bu belge sıra, gerekçe ve faz kapılarıdır. Çelişki olursa SPEC ve BACKLOG kazanır. v1'in yol haritası ve durum belgesi [archive/v1/](archive/v1/) içinde.

## 1. Neredeyiz (22 Ekim 2026)

**Canlıda çalışan (v1):** Vercel + Render + Neon üzerinde:
- kiralama akışı uçtan uca: arama, 15 dakika tutma, özet, kampanya kodu, puanla ödeme, sürücü bilgileri, sahte ödeme, onay;
- hesap: kayıt, giriş, Google ile giriş, şifre sıfırlama e-postası, ayarlar, oturumlar, Rezervasyonlarım, Puanlarım, iptal;
- kurumsal teklif ve iletişim formları;
- SSS, Yardım, Rehberler, Bayilerimiz;
- çerez onayı, CSP ve güvenlik başlıkları.
- CI: lint, tip, test (gerçek Postgres), build, link kontrolü, e2e.

**Eksik ya da zayıf olan:**
- **Güvenlik ve temel:** 22 Ekim keşfi bir kritik, beş yüksek bulgu çıkardı ([QUALITY.md](QUALITY.md)).
- **Yönetim yolu yok:** kampanya kodu, bayi ve araç ancak veritabanından elle yönetiliyor; kurumsal hesap açmanın yolu yok.
- **Satılan ama çalışmayan özellikler:** ürün ve hizmet sayfalarındaki filo paneli, takip ve talepler yalnızca metin.
- **v1'den açık kalanlar:** production Lighthouse, ekran okuyucu turu, 4 modelin fotoğrafı, analytics kararı, `NEXT_PUBLIC_SITE_URL`.

**Ekip:** G Product/Project Manager, Berkay full stack. Önceki FE/BE ayrımı ve 20 Ekim'deki iş dağılımı (Y79–Y108) geçersizdir; arşivde referans olarak durur.

## 2. Sıranın gerekçesi

1. **Önce güvenlik (Faz 1).** Kritik ve yüksek bulgular canlıda kötüye kullanılabilir: geçmiş tarihli rezervasyonla sınırsız puan, filoyu kilitleme, kod tahmini. Yeni özellik bu açıkların üstüne kurulmaz. İşler küçüktür (S/M), hızla kapanır.
2. **Sonra temel (Faz 2).** Panel ve Filom 30'dan fazla yeni uç ve 15'ten fazla yeni tablo getirecek. Doğrulama, hız sınırı, veritabanı kısıtları ve kod düzeni şimdi oturursa her yeni uç bunları baştan doğru kullanır. Sonra yapılırsa iki kat iş çıkar.
   - Faz 2'nin iç sırası: önce kod tabanının altyapısı (doğrulama → hız sınırı → oturum → veritabanı), sonra temizlik (clean code, çeviri yükü, bilgi mimarisi, içerik kopyası), en son ölçüm turları (UI/UX, performans, güvenlik). Böylece turlar temizlenmiş kodu ölçer.
3. **Panel temeli (Faz 3)** sonraki her fazın ortak parçasıdır: rol, işlem kaydı, tablo/form bileşenleri.
4. **G'nin ilk isteği önce (Faz 4):** kampanya kodları, bayi ve araç yönetimi. Kod yönetimi Faz 1'deki kod güvenliğinin üstüne kurulur.
5. **Operasyon (Faz 5)** günlük işi panelden yürütmeyi sağlar ve Filom'dan bağımsızdır.
6. **Şirketler (Faz 6) Filom'un önkoşuludur:** kurumsal hesap ancak panelden açılır.
7. **Filom (Faz 7–9):** önce veri ve temel ekranlar, sonra para (fatura, masraf), sonra raporlar. Her faz kendi başına gösterilebilir bir değer üretir.
8. **Talepler ve canlı takip (Faz 10–11)** Filom'un üstüne kurulur ve birbirinden bağımsızdır. Takip en çok belirsizlik taşıyan iş (harita, simülasyon) olduğu için sona yakındır.
9. **Yayın (Faz 12):** e-postalar talepler ve iptallerle birlikte anlam kazanır; son kabul her şeyin üstünde.

## 3. Fazlar ve kapılar

Her fazın sonunda G canlıda (ya da son PR'ın önizlemesinde) bir **faz turu** yapar ve kapıyı işaretler. Kapı geçilmeden sonraki faza başlanmaz.

| Faz | İşler | Çıktı | Kapı (G işaretler) |
|---|---|---|---|
| 0 · Süreç | V2-01 | v2 belgeleri, issue'lar | Etiketler, milestone'lar, 46 issue açık; eşleme tablosu dolu |
| 1 · Acil güvenlik | V2-02 → V2-06 | Kritik ve yüksek açıklar kapalı | Geçmiş tarihli rezervasyon ve tavan denemeleri canlıda reddediliyor; QUALITY G-01–G-08 kapalı |
| 2 · Temel | V2-07 → V2-22 | Sağlam, ölçülmüş, temiz kod tabanı | V2-22 raporu: QUALITY'de Kritik/Yüksek/Orta açık yok ([SECURITY.md](SECURITY.md) "Faz 2 kapısı"). **Gevşetilen iki şart:** Lighthouse hedefte değil (mobil LCP/TBT, QUALITY P-04 "Kabul edildi"); gerçek ekran okuyucu turu proje kapsamına alınmadı (U-05 "Kabul edildi"). **Kapı 29 Ekim 2026'da Berkay tarafından işaretlendi** (G'nin onayı beklenmeden; G'nin itirazı olursa geri alınır) |
| 3 · Panel temeli | V2-23 → V2-25 | Yönetici girişi, kabuk, Özet | Yönetici girer, müşteri 404 görür; işlem kaydı yazılıyor |
| 4 · Katalog | V2-26 → V2-30 | Kod, bayi, model, araç yönetimi | SPEC §6 madde 3, 4, 5 canlıda geçiyor |
| 5 · Operasyon | V2-31 → V2-32 | Rezervasyon, teklif, mesaj yönetimi | SPEC §6 madde 6 |
| 6 · Şirketler | V2-33 → V2-34 | Kurumsal hesap açma, hesap kapatma | SPEC §6 madde 7'nin ilk yarısı (davet → giriş) |
| 7 · Filom temeli | V2-35 → V2-36 | Filom'da araç, personel, zimmet | Örnek şirketle zimmet turu |
| 8 · Filom maliyetleri | V2-37 → V2-38 | Fatura ve masraf | SPEC §6 madde 8 (rapor hariç) |
| 9 · Raporlar | V2-39 → V2-40 | Raporlar, Yeşil Filo | SPEC §6 madde 8 rapor kısmı, madde 10 şarj kısmı |
| 10 · Talepler | V2-41 → V2-42 | Servis ve transfer talepleri | SPEC §6 madde 9 |
| 11 · Canlı takip | V2-43 | Harita simülasyonu | SPEC §6 madde 10 |
| 12 · Yayın | V2-44 → V2-46 | E-postalar, canlı ortam, son kabul | SPEC §6'nın tamamı; `v2.0.0` |

**Ara sürümler:** her faz kapısında `main`'e etiket atılır (`v2.0.0-faz1`, `v2.0.0-faz2`...). Bir şey bozulursa geri dönülecek nokta bellidir.

## 4. G'nin işleri (kod değil)

| Ne zaman | İş |
|---|---|
| Faz 0 | V2-01 PR'ını incele ve birleştir. GitHub'da etiketleri ve milestone'ları oluştur, issue'ları aç ([WORKFLOW.md](WORKFLOW.md) §2), eşleme tablosunu doldur. Repo ayarlarında secret scanning ve push protection'ı aç (public repoda ücretsiz) |
| V2-03 öncesi | Kişi başı aktif rezervasyon tavanı (öneri 3) |
| V2-12 öncesi | KVKK saklama süresi (öneri 2 yıl) |
| V2-28 (karar verildi: Vercel Blob, 29 Ekim 2026) | Berkay Vercel'de Blob mağazasını (Public) açar ve `BLOB_PUBLIC_HOST`'u Vercel'e ve Cloud Run'a girer ([DEPLOY.md](DEPLOY.md) §5a); token Vercel'de kendiliğinden eklenir |
| V2-36 sırasında | KVKK metnindeki kurumsal personel bölümünü onaylamak |
| V2-40 / V2-43 öncesi | Harita kararı (öneri Google Maps; anahtar kısıtlı olmalı) |
| V2-44 öncesi | E-posta gönderen alan adı (yoksa Resend test adresi) |
| V2-45 | Analytics aracı kararı; Vercel'de `NEXT_PUBLIC_SITE_URL` |
| Her faz sonu | Faz turu ve kapı |

## 5. Berkay'ın hesap ve ortam işleri (kod değil)

- V2-02 sonrası: canlıda kötü kayıt sorgusunu çalıştırmak, sonucu G'ye bildirmek.
- V2-05 sonrası: canlı seed'i yeni korumalı hâliyle bir kez çalıştırmak; kodların durumunu G'ye bildirmek.
- V2-11 sonrası: canlı veritabanında `prisma migrate deploy` öncesi yedek almak.
- V2-23 sonrası: Neon'da ilk yönetici hesabını `pnpm admin:create` ile açmak (G'nin e-postasıyla).
- V2-35, V2-40, V2-43 sonrası: canlıya örnek şirket, istasyon ve rota seed'i.
- V2-45: Maps anahtar kısıtı, `API_ACCESS_KEY` yenileme kontrolü, haftalık `pg_dump` ve **geri yükleme denemesi**.

## 6. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Tek geliştirici, uzun liste (46 iş) | Takvim kayar | Fazlar kendi başına değer üretir; Faz 9–11 gerekirse G kararıyla v2.1'e kayabilir. Faz 1–2 kaymaz |
| Cloud Run örneğinin sıfıra inmesi ve yeniden başlaması | Sayaçlar ve görevler aksar | ADR-27 kalıcı sayaç; zamanlanmış görevler açılışta kaçırılanı telafi eder |
| Neon Free sınırları (depolama, bağlantı) | Filom seed'i ve sayaçlarla büyüme | Sayaç tablosu günlük temizlenir; seed ölçülü; V2-45'te kullanım kontrolü |
| Ücretsiz katman koşullarının değişmesi (Vercel, Blob, Resend) | Hizmet kesilir | Her karar gününde koşullar resmi sayfadan doğrulanır, DEPLOY.md'ye tarihle yazılır |
| Büyük refactor'ların (V2-07, V2-13, V2-14) davranışı bozması | Gerileme | Önce test (V2-19'un API kısmı gerekiyorsa öne alınır); PR'da önce/sonra e2e |
| Kapsam büyümesi | v2 hiç bitmez | Yeni istek önce SPEC'e PR olarak girer, G onaylar, BACKLOG'a yeni satır olur (WORKFLOW.md §5) |
