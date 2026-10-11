# Ön yüz ve API sözleşmesi arasındaki farklar

12 Ekim 2026. `docs/api/openapi.yaml` v0.1 ile ön yüzün ara tipleri (`apps/web/lib/*.ts`) karşılaştırıldı. Sözleşmeden üretilen tipler `apps/web/lib/api-types.ts` içinde (`pnpm --filter @novera/web gen:api`); ortak parçalar (`Currency`, `Money`, `LocalizedText`) derleyici testiyle sözleşmeye bağlı (`tests/api-contract.test.ts`).

API gerçeklendiğinde ön yüzde **bir uyarlayıcı katman** gerekecek (taklit dosyaları yerine `*-client.ts`). Aşağıdakiler ya sözleşmeye eklenmeli (BE) ya da uyarlayıcıda çevrilmeli (FE).

## Sözleşmede eksik, ön yüz bunu gösteriyor (BE'ye iletilecek)

| Konu | Ön yüz ne bekliyor | Sözleşmede |
|---|---|---|
| SSS konusu | `topic`: `rezervasyon`, `odeme`, `teslim`, `hasar`, `hesap`, `kurumsal` (Yardım merkezi bu gruplara göre) | `FaqItem`'da yok |
| Kurumsal hesap bilgisi | firma adı, vergi dairesi, şehir, telefon, yetkili ünvanı, satış iletişimi (`/profil` kurumsal sayfa) | `User.companyName` var; diğerleri yok |
| Teklif talepleri listesi | `GET /me/quotes`: referans, tarih, araç sayısı, süre, durum (`RECEIVED`, `IN_REVIEW`, `OFFERED`) | Uç yok |
| Bekleyen puan | Puanlarım sayfasında "bekleyen puan" | `Points`'te yok. Uyarlayıcıda, `/me/reservations` içindeki henüz bitmemiş `CONFIRMED` rezervasyonların `pointsEarned` toplamından türetilebilir; BE için gerekmiyor |

## Biçim farkları (ön yüz uyarlayıcıda çevirecek)

| Konu | Ön yüz (ara tip) | Sözleşme |
|---|---|---|
| Rezervasyon | düz: `vehicle.brand/model`, `pickupCity`, `returnCity`, `totalPrice` | iç içe: `vehicle.model`, `pickupBranch`, `returnBranch`, `price` (`PriceBreakdown`) |
| Hesap türü | `individual` / `corporate` | `INDIVIDUAL` / `CORPORATE` |
| SSS hedef kitlesi | `bireysel` / `kurumsal` | `INDIVIDUAL` / `CORPORATE` (`audience` sorgu parametresi) |
| Çalışma saatleri | `{ open, close }` ya da `null` | `"08:30-19:00"` ya da `"closed"` |
| Puan geçmişi | `{ id, date, reservationNumber, points }` | `history[{ points, reservationNumber?, createdAt }]`, kural metni `rules` (iki dilli) |
| Tutma kimliği | örnek veride `<bitiş ms>.<araç>` | `uuid`; ön yüz kimliği olduğu gibi taşır, biçimine güvenmez |
| Bayi / araç / ek hizmet | ara tipler | `Branch`, `VehicleModel`, `Extra` şemaları; alanlar büyük ölçüde örtüşüyor |

## Doğru çıkanlar

- Tercihler (`locale`, `theme`, `currency`) `PATCH /me` ile geliyor; ayrı bir tercih ucu gerekmiyor.
- `pointsEarned` rezervasyon cevabında var.
- Tutma (`POST /holds`, `expiresAt`) ve fiyat dökümü (`POST /reservations/price`) ön yüzün akışıyla uyumlu.
- Tema varsayılanı `light`, `system` değeri var.
