# V2-24 · Yönetim paneli kabuğu ve ortak bileşenler

**Faz:** 3 · Panel temeli · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-23
**Belgeler:** ADMIN.md §3, §3.4 · DESIGN.md §8 · ARCHITECTURE ADR-24, §4

## Amaç
Bundan sonraki her panel ekranının (ve Filom'un) kullanacağı yerleşimi ve ortak parçaları bir kez, doğru ve erişilebilir biçimde yapmak.

## Kapsam
- **Rotalar:** `app/[locale]/yonetim/layout.tsx` (EN `/en/admin`; `i18n/routing.ts`'e eklenir).
  - Sunucuda `getSession`: giriş yoksa `/giris?sonra=yonetim` (giriş sayfası bu dönüş değerini kabul edecek şekilde genişletilir; açık yönlendirme olmaz, değer sabit listeden gelir); rol yoksa `notFound()`.
  - Tüm sayfalar `noindex`; sitemap ve `llms.txt` dışında.
- **Yerleşim:** xl'de solda ikonlu menü, dar ekranda üstte açılır menü. Menü öğeleri ADMIN.md §3'teki ekranlardır; henüz yapılmamış olanlar gizlidir.
- **Ortak bileşenler** (`components/admin/`):
  - `DataTable`: sıralanabilir başlık, `aria-sort`, satır bağlantısı, boş/yükleniyor/hata;
  - `Pagination`;
  - `SearchBox`;
  - `FilterChips` (durum adreste);
  - `BilingualField` (TR/EN sekme, ikisi zorunlu);
  - `ListField` (satır ekle, sil, taşı);
  - `ConfirmDialog` (işlemin adı düğmede, odak "Vazgeç"te);
  - `Toast` (`aria-live`);
  - `StaleWriteBanner`;
  - `UnsavedChangesGuard`;
  - `StatusChip` (metinli durum);
  - `FileField` (V2-28 kullanır, burada yalnız arayüzü).
- **Sorgu yardımcısı:** adres parametrelerini (`sayfa`, `sirala`, süzgeçler) API sorgusuna çeviren tek bir yardımcı.
- **Metinler:** `messages/tr|en/admin.json` dosyalarına kayıt (`i18n/messages.ts`). Namespace yalnızca panel rotalarında istemciye gider (V2-15 deseni).
- **Bileşen sergisi:** geliştirme ortamında bileşenleri gösteren sayfa (`/dev/admin`, production'da 404; mevcut `/dev/components` deseni).

## Kapsam dışı
Modül ekranları (V2-25 ve sonrası).

## Kabul kriterleri
- [ ] Yönetici `/yonetim`'e girer; müşteri 404 görür; girişsiz kullanıcı girişe gider ve sonra panele döner (e2e).
- [ ] Bileşenlerin her biri klavyeyle tam kullanılabilir; axe temiz (bileşen sergisinde e2e).
- [ ] 375/768/1280'de taşma yok; geniş tablo kendi kutusunda kayar.
- [ ] Tüm metinler iki dilde.
- [ ] 375, 768 ve 1280 ekran görüntüleri.

## Etiketler
`faz-3` `ozellik` `P2` `web`
