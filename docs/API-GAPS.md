# Ön yüz ve API sözleşmesi arasındaki farklar

12 Ekim 2026. `docs/api/openapi.yaml` v0.1 ile ön yüzün ara tipleri (`apps/web/lib/*.ts`) karşılaştırıldı. Sözleşmeden üretilen tipler `apps/web/lib/api-types.ts` içinde (`pnpm --filter @novera/web gen:api`); ortak parçalar (`Currency`, `Money`, `LocalizedText`) derleyici testiyle sözleşmeye bağlı (`tests/api-contract.test.ts`).

API gerçeklendiğinde ön yüzde **bir uyarlayıcı katman** gerekecek (taklit dosyaları yerine `*-client.ts`). Aşağıdakiler ya sözleşmeye eklenmeli (BE) ya da uyarlayıcıda çevrilmeli (FE).

## Sözleşmede eksik, ön yüz bunu gösteriyor (BE'ye iletilecek)

12 Ekim'de bu tabloda iki satır vardı (SSS `topic`, kurumsal hesap bilgisi); ikisi de sözleşmeye girdi, bkz. aşağıdaki "Bağlandı (18 Ekim)".

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

## Hâlâ sözleşmede eksik (18 Ekim itibarıyla)

| Konu | Ön yüz | Sözleşme / API |
|---|---|---|
| Tutmayı sorgulama | Özet ve ödeme sayfaları geri sayım için bitiş zamanını ister | `GET /holds/{id}` yok ve eklenmesi planlı değil: ön yüz tutma kimliğini `<uuid>.<bitişMs>` olarak adreste taşır, API'ye yalnızca uuid gider |
| Tek araç | Özet sayfası aracı model + araç kimliğinden kurar (`/vehicle-models`) | Tek araç ucu yok |
| Model yılı, model listesinde | Araçlarımız sayfası | `year` aracın (`VehicleOffer`, `Reservation.vehicle`) alanıdır; `GET /vehicle-models` model başına döner ve yıl taşımaz |

## Bağlandı (19 Ekim)

- Kampanya kodu: `ReservationRequest.promoCode`; indirim `PriceLine` olarak gelir (`type: DISCOUNT`, eksi tutar, en sonda), `PriceBreakdown.promo` kodun uygulanıp uygulanmadığını söyler. Kodlar veritabanındadır (`PromoCode`: `NOVERA10` %10, `HOSGELDIN` %5; tohumla gelir). Kuralları web'inkiyle aynıdır: yüzde araç ve ek hizmetlerin toplamından düşer ve aşağı yuvarlanır, puan kalanın en çok yarısını karşılar. `POST /reservations/price` olmayan kodu hata saymaz (`promo.applied: false`, fiyat düz); `POST /reservations` `422 UNKNOWN_CODE` verir.

## Bağlandı (18 Ekim)

Sözleşme API'ye hizalandı (`docs/api/openapi.yaml`); ön yüz `pnpm --filter @novera/web gen:api` ile tipleri yeniden üretir.

- `year`: `VehicleOffer.year` ve `Reservation.vehicle.year` (fiziksel aracın model yılı).
- SSS: `FaqItem.audience` ve `FaqItem.topic` döner; `GET /faq` için `audience` artık isteğe bağlı (verilmezse tüm sorular, Yardım merkezi için).
- Puanla ödeme: `ReservationRequest.usePoints`, `PriceBreakdown.pointsUsed` ve `payable` (`POST /reservations/price` ve `POST /reservations`, ayrıca `price` olarak rezervasyonda).
- `PriceLine.slug`: araç satırında modelin, ek hizmet satırında ek hizmetin slug'ı.
- `GET /me/reservations/{id}`: tek rezervasyon (başkasının ya da olmayan için 404).
- `DELETE /holds/{id}`: tutmayı bırakır; yalnızca tutmayı açan istemci bırakabilir, olmayan ya da başkasının tutması sessizce `204`.

## Bağlandı (17 Ekim)

- Katalog ve akış: `GET /branches`, `/vehicle-models`, `/vehicles`, `/extras`, `POST /holds`, `POST /reservations/price`, `GET /faq` (`lib/fleet-client.ts`, `hold-client.ts`, `price-client.ts`, `faq-client.ts`). `USE_MOCKS=1` yalnızca testler ve yerel çalışma için duruyor.
- Hesap: `PATCH /me` (ad, tercihler, bildirimler), `DELETE /me`, `POST /me/password`, `GET /me/sessions`, `DELETE /me/sessions` (`lib/account-actions.ts`).
- Ehliyet doğrulama ürünün kendi deneme özelliği; artık canlıda da çalışır.

## Bağlandı (16 Ekim)

- `GET /me/reservations`, `/me/points`, `/me/quotes`, `POST /reservations`, `POST /me/reservations/{id}/cancel` ve şifre sıfırlama uçları ön yüzde gerçek çağrıya bağlı (`lib/api-account.ts`, `lib/reservation-client.ts`, `lib/password-reset-actions.ts`). Bekleyen puan ve teklif talepleri sözleşmeye eklendi, buradan çıkarıldı.
- Giriş, kayıt, çıkış ve oturum (`POST /auth/login`, `/auth/register`, `/auth/logout`, `GET /me`) ön yüzde gerçek uca bağlı (`lib/auth-actions.ts`, `lib/session.ts`): API'nin `novera_session` çerezi tarayıcıya kopyalanır, `getSession()` onu `GET /me` ile okur.

## Doğru çıkanlar

- Tercihler (`locale`, `theme`, `currency`) `PATCH /me` ile geliyor; ayrı bir tercih ucu gerekmiyor.
- `pointsEarned` rezervasyon cevabında var.
- Tutma (`POST /holds`, `expiresAt`) ve fiyat dökümü (`POST /reservations/price`) ön yüzün akışıyla uyumlu.
- Tema varsayılanı `light`, `system` değeri var.
