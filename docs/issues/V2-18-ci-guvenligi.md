# V2-18 · CI güvenliği: bağımlılık taraması ve güncelleme botu

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** S · **Bağımlı:** V2-01
**Bulgular:** QUALITY G-18, T-04

## Amaç
Bilinen açığı olan bir bağımlılığın fark edilmeden canlıya girmesini önlemek ve güncellemeleri düzenli hale getirmek.

## Kapsam
- **CI'da `pnpm audit --prod --audit-level=high`:**
  - Yüksek ve kritik bulguda iş kırmızı olur.
  - Çalışan uygulamaya girmeyen bilinen bulgular (SECURITY.md'deki Prisma CLI içindekiler) gerekçeli bir izin listesiyle geçilir. Liste repoda durur ve her bulgunun yanında gözden geçirme tarihi yazar.
- **`.github/dependabot.yml`:**
  - npm (kök workspace) ve GitHub Actions için haftalık güncelleme;
  - küçük ve yama güncellemeleri gruplanır;
  - en çok 5 açık PR.
- **Gizli anahtar taraması:** GitHub secret scanning ve push protection. Repo ayarı olduğu için G açar (V2-01'in kabul maddesi); bu iş açıldığını doğrular.
- **CodeQL (isteğe bağlı):** repo public ise JavaScript/TypeScript için CodeQL iş akışı eklenir; private ise PR'da "uygulanmaz" yazılır.

## Teknik notlar
Dosyalar: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `docs/SECURITY.md` (bağımlılıklar bölümü).

## Kabul kriterleri
- [ ] Bilerek eklenen açıklı bir sürüm, ayrı ve birleştirilmeyen bir denemede, CI'ı kırmızı yapar (ekran görüntüsü).
- [ ] Dependabot ilk PR'larını açtı.
- [ ] Secret scanning açık (ayarlar ekran görüntüsü).
- [ ] QUALITY'de G-18 ve T-04 güncel.

## Etiketler
`faz-2` `temel` `guvenlik` `ci` `P1`
