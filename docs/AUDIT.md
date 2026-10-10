# Erişilebilirlik ve performans denetimi (BACKLOG #38)

Tarih: 2026-10-09. Kapsam: `main` üzerindeki sayfalar. **Bu denetim kısmidir:** uygulama bu makinede derlenemediği için (SWC yerel izin hatası) Lighthouse ve axe çalıştırılamadı. Aşağıda yalnızca kodun ve tasarım belirteçlerinin okunmasıyla görülebilenler var. #38 bu belgeyle **kapanmaz**.

## Kontrol edildi, sorun yok

- **Metin kontrastı (WCAG 1.4.3, en az 4.5:1), açık ve koyu temada hesaplandı:** gövde, ikincil ve soluk metin; zemin, yüzey ve soluk yüzey üzerinde; bağlantı, seçili, vurgu, hata ve koyu bant metinleri. Hepsi geçti; metin çiftlerinin en düşüğü açık temada soluk metin (`fg-subtle`) soluk yüzeyde 4,71:1.
- **Metin dışı kontrast (1.4.11, en az 3:1):** form kenarlığı ve odak halkası iki temada da geçti.
- **Tek `h1`:** her sayfanın tek bir ana başlığı var (auth, yasal ve profil sayfalarında ortak kabuktan geliyor).
- **Yer işaretleri:** tek `<main id="main">` ve ilk durak olan "içeriğe geç" bağlantısı.
- **Hareket:** `prefers-reduced-motion` genel olarak kapatıyor.
- **Dış bağlantılar:** `target="_blank"` kullanılan her yerde `rel="noopener"` var.
- **Dokunma hedefleri:** düğme, bağlantı ve form kontrolleri en az 44 px (ortak bileşenlerde `min-h-11`).
- **Form alanları:** hepsi `Field` ile etiket, ipucu ve hata bağlantısı alıyor.

## Bulundu ve düzeltildi

- **Profil sekmesinde seçili göstergesi koyu temada yetersizdi:** altı çizgi `primary` renkteydi, bu renk koyu yüzeyde 2,71:1 (en az 3:1 gerekir). `border-focus` ile değiştirildi (koyu temada açık yeşil).

## Bilinen kural: `primary` yalnızca dolgu için

Koyu temada `primary` (`#25704f`) yüzeyde 3:1'in altında kalır. Üzerinde beyaz metin olan dolgu (düğme) güvenli, ama tek başına bir **durum göstergesi** (kenarlık, çizgi, simge) olarak kullanılmamalı; onun yerine `focus` ya da `link` kullanılmalı.

## Çalıştırılamadı (sıradaki adım)

SWC izin sorunu çözülünce:

1. `pnpm build` ve `pnpm start`, ardından her sayfada 375, 768 ve 1280 px'te Lighthouse (erişilebilirlik, performans, en iyi uygulamalar, SEO).
2. axe (tarayıcı eklentisi ya da `@axe-core/playwright`) ile her sayfa, açık ve koyu temada. Playwright testlerine (#37) eklenmesi en iyisi.
3. Ekran okuyucu ile iki akış: rezervasyon (ana sayfa → onay) ve teklif.
4. Performans: LCP görseli (araç fotoğrafları gelince `priority` ve `sizes`), harita kodunun yalnızca İletişim'de yüklendiği, yazı tipi dosyalarının (Latin + Latin Extended) boyutu.
5. Klavye: mobil menü, tarih seçici, bayi seçici, harita/liste anahtarı ve iletişim kartları.
