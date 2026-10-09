# Proje durumu

Son güncelleme: 2026-10-09. Bu belge bir anlık görüntüdür; kalıcı kararlar ARCHITECTURE'a, kapsam SPEC'e, iş listesi BACKLOG'a aittir. Çelişki olursa onlar kazanır.

Issue numarası = BACKLOG numarası + 9. PR gövdesinde ve commit'te **issue** numarası kullanılır.

## 1. Yapıldı (main'de)

- İskelet, tasarım token'ları, i18n, tema, header/footer/mobil menü.
- Ürünler ve Hizmetler sayfaları, Hakkımızda, giriş/kayıt sayfaları (PR #57, #59).
- Next proxy (`/api/*` → `API_URL`), API kararları dokümanı (ADR-14…17) (#61, #64).

## 2. Açık PR'lar (FE, sırayla birleşmeli)

Mesaj dosyaları artık özellik başına ayrı (`messages/<dil>/<özellik>.json`), bu yüzden eski `en.json`/`tr.json` çakışması kalmadı. Yığın birbirinin doğrudan atası olacak şekilde hizalandı.

| Sıra | PR / dal | İçerik |
|---|---|---|
| 1 | #62 `refactor/messages-split` | Mesajları özellik dosyalarına böler |
| 2 | #65 `feat/legal-pages` | KVKK/şartlar sayfaları |
| 3 | #60 `feat/profile-pages` | Profil sayfaları |
| 4 | #63 `fix/time-zone` | `Europe/Istanbul` |
| 5 | #66 `feat/currency` | TRY/EUR/USD seçici |
| 6 | `feat/fleet-page` | Araçlarımız |
| 7 | `feat/rental-search` | Arama formu + `/araclar` (kısmi: `Refs`) |
| – | `chore/ci-and-pr-template` | CI'a typecheck |
| – | `docs/project-status` | Bu belge, README/SPEC/BACKLOG düzeltmeleri |

`feat/products-pages` ve `feat/auth-pages` yerel dalları eskidir (PR'ları zaten main'de); itmeyin.

## 3. Eksikler ve kim yapacak

| İş | Sahip | Not |
|---|---|---|
| Kalan FE issue'ları: #25–#29, #35, #41, #43, #46, #47, #49 | FE | Rezervasyon akışı, kurumsal teklif, iletişim, SSS, hata sayfaları |
| Kalan BE issue'ları: #15, #24, #30, #31, #34, #36, #37, #42, #44, #48 | BE | Auth, araç/müsaitlik, rezervasyon, teklif |
| Y1–Y9 (BACKLOG M6) | Y1/Y2/Y6 BE, kalanı FE | Issue'ları açmak kullanıcıya ait |
| Prisma: `Product`, `Service`, `ExchangeRate`; `Reservation` üzerinde para birimi + kur anlık görüntüsü | BE | ADR-15, ADR-17 gereği |
| Seed verisi (bayiler, sınıflar, araçlar, SSS) | BE | FE'deki `mocks/fleet.ts` ile aynı şekil |
| `openapi.yaml` | BE yazar, FE gözden geçirir | İki tarafın sözleşmesi; yoksa FE tipleri tahmindir |
| FE'yi API'ye bağlama (`USE_MOCKS` kaldırma) | FE | API hazır olunca |
| Web testleri | FE | Şu an yok |
| favicon, robots, sitemap, OG görseli | FE | Yayın öncesi |
| Gerçek fotoğraflar (şimdilik yer tutucu) | İKİ | Karar bekliyor |

## 4. Karar bekleyenler

1. **Fotoğraflar:** telifsiz stok mu, üretilmiş görsel mi, yer tutucu mu kalsın?
2. **Ödeme:** v1'de yalnızca "bayide öde" mi, sahte ödeme adımı mı? (SPEC ile uyumlu olan seçilmeli.)
3. **Kur kaynağı:** ADR-15 günlük harici servis diyor; hangi servis ve anahtar kimde?
4. **Rezervasyonda kur:** rezervasyon anındaki kur mu saklanacak, yoksa TRY mi esas? (Öneri: ikisi de.)
5. **Dağıtım:** nerede yayınlanacak (web + API + DB)? Şu an yalnızca yerelde çalışıyor.

## 5. Düzeltilenler

- README: kuruluş yılı 2003 → 2012 (kod ve içerikle uyumlu), Node 24 (`.nvmrc`), API "kurulmadı" ifadesi kaldırıldı.
- CI: typecheck adımı eklendi (`chore/ci-and-pr-template`).
- PR şablonu: `Closes #N` için issue numarası uyarısı.

## 6. Süreç kuralları (çakışmayı önlemek için)

- Yeni metin yalnızca ilgili özellik dosyasına (`messages/tr/<özellik>.json` ve `en`). `i18n/messages.ts` yeni dosya eklenince güncellenir.
- Bir dal bir öncekinin üzerine kuruluysa, öncekini main'e birleştirmeden sonrakini birleştirmeyin; PR'ı main'e açın, sırayla birleştirin.
- `Closes #N` yalnızca iş tamamen bitince; kısmi iş için `Refs #N`.
