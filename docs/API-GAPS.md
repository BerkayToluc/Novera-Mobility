# Ön yüz ve API sözleşmesi arasındaki farklar

12 Ekim 2026. `docs/api/openapi.yaml` v0.1 ile ön yüzün ara tipleri (`apps/web/lib/*.ts`) karşılaştırıldı. Sözleşmeden üretilen tipler `apps/web/lib/api-types.ts` içinde (`pnpm --filter @novera/web gen:api`); ortak parçalar (`Currency`, `Money`, `LocalizedText`) derleyici testiyle sözleşmeye bağlı (`tests/api-contract.test.ts`).

API gerçeklendiğinde ön yüzde **bir uyarlayıcı katman** gerekecek (taklit dosyaları yerine `*-client.ts`). Aşağıdakiler ya sözleşmeye eklenmeli (BE) ya da uyarlayıcıda çevrilmeli (FE).

## Sözleşmede eksik, ön yüz bunu gösteriyor (BE'ye iletilecek)

| Konu | Ön yüz ne bekliyor | Sözleşmede |
|---|---|---|
| SSS konusu | `topic`: `rezervasyon`, `odeme`, `teslim`, `hasar`, `hesap`, `kurumsal` (Yardım merkezi bu gruplara göre) | `FaqItem`'da yok |
| Kurumsal hesap bilgisi | firma adı, vergi dairesi, şehir, telefon, yetkili ünvanı, satış iletişimi (`/profil` kurumsal sayfa) | `User.companyName` var; diğerleri yok. Gerçek oturumda sayfa yalnızca bilinen satırları gösterir, satış e-postası olarak `satis@` adresini kullanır |

## Biçim farkları (ön yüz uyarlayıcıda çevirecek)

| Konu | Ön yüz (ara tip) | Sözleşme |
|---|---|---|
| Rezervasyon | düz: `vehicle.brand/model`, `pickupCity`, `returnCity`, `totalPrice` | iç içe: `vehicle.model`, `pickupBranch`, `returnBranch`, `price`; `lib/api-mappers.ts` çevirir |
| Hesap türü | `individual` / `corporate` | `INDIVIDUAL` / `CORPORATE` |
| SSS hedef kitlesi | `bireysel` / `kurumsal` | `INDIVIDUAL` / `CORPORATE` (`audience` sorgu parametresi) |
| Çalışma saatleri | `{ open, close }` ya da `null` | `"08:30-19:00"` ya da `"closed"` |
| Puan geçmişi | `{ points, reservationNumber, createdAt }` (`history`, ön yüz `PointsAccount`) | `history[{ points, reservationNumber?, createdAt }]`, `pending` ve kural metni `rules` (ön yüz kuralı kendi çevirisinden gösterir) |
| Tutma kimliği | örnek veride `<bitiş ms>.<araç>` | `uuid`; ön yüz kimliği olduğu gibi taşır, biçimine güvenmez |
| Bayi / araç / ek hizmet | ara tipler | `Branch`, `VehicleModel`, `Extra` şemaları; alanlar büyük ölçüde örtüşüyor |

## Bağlandı (16 Ekim)

- `GET /me/reservations`, `/me/points`, `/me/quotes`, `POST /reservations`, `POST /me/reservations/{id}/cancel` ve şifre sıfırlama uçları ön yüzde gerçek çağrıya bağlı (`lib/api-account.ts`, `lib/reservation-client.ts`, `lib/password-reset-actions.ts`). Bekleyen puan ve teklif talepleri sözleşmeye eklendi, buradan çıkarıldı.
- Giriş, kayıt, çıkış ve oturum (`POST /auth/login`, `/auth/register`, `/auth/logout`, `GET /me`) ön yüzde gerçek uca bağlı (`lib/auth-actions.ts`, `lib/session.ts`): API'nin `novera_session` çerezi tarayıcıya kopyalanır, `getSession()` onu `GET /me` ile okur.
- Profil güncelleme, hesap silme, tercihler, bildirimler, şifre değiştirme, oturumlar; araç/bayi/tutma/fiyat uçları ön yüzde hâlâ taklit veriyle (`USE_MOCKS` kapalıyken "kullanılamıyor" der).

## Doğru çıkanlar

- Tercihler (`locale`, `theme`, `currency`) `PATCH /me` ile geliyor; ayrı bir tercih ucu gerekmiyor.
- `pointsEarned` rezervasyon cevabında var.
- Tutma (`POST /holds`, `expiresAt`) ve fiyat dökümü (`POST /reservations/price`) ön yüzün akışıyla uyumlu.
- Tema varsayılanı `light`, `system` değeri var.
