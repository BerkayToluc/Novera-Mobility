# V2-41 · Servis talepleri: yol yardım, ikame araç, bakım ve lastik

**Faz:** 10 · Talepler · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-36
**Belgeler:** SPEC §3.D · FLEET.md §3, §3.1, §4 · ADMIN.md §3.2 · ARCHITECTURE ADR-31

## Amaç
Hizmetler sayfasındaki üç hizmeti (Akıllı Yol Yardım & Çekici, Kesintisiz İkame Araç, Periyodik Bakım & Lastik Oteli) Filom'dan açılan ve Novera'nın panelden yürüttüğü talepler olarak çalıştırmak.

## Kapsam
- **Veri modeli:** `ServiceRequest`, `ServiceRequestEvent` (ADR-31). Numara sequence ile (`TLP-2026-00001`).
- **Türler ve `details` şemaları (zod):**
  - `ROADSIDE`: olay türü (arıza, kaza, lastik, yakıt/şarj), konum (adres ya da enlem/boylam), açıklama;
  - `REPLACEMENT_VEHICLE`: teslim adresi, tarih, tahmini süre (gün);
  - `MAINTENANCE`: işlem (periyodik bakım, yaz lastiği, kış lastiği, muayene), tercih edilen tarih, vale (evet/hayır), adres.
- **Durum geçişleri** tür başına bir tabloda (SPEC §3.D); geçersiz geçiş `409 INVALID_TRANSITION`.
- **Müşteri uçları:**
  - `GET/POST /fleet/requests`, `GET /fleet/requests/{number}`;
  - `POST /fleet/requests/{number}/cancel`: yalnızca `RECEIVED` durumunda;
  - şirket başına saatte en çok 20 talep.
- **Yönetim uçları:** `GET /admin/requests`, `GET /admin/requests/{number}`, `POST /admin/requests/{number}/status` (`{ status, note?, assignee? }`).
- **Filom ekranları:**
  - `/filom/talepler`: liste;
  - `/filom/talepler/yeni`: tür seçimi → türe özel form; "konumumu kullan" yalnızca düğmeyle, izin reddedilirse adres alanı;
  - detay: zaman çizelgesi, atanan kişi;
  - her talep ekranında operasyon masası telefonu (v1'deki telefon balonu bileşeni) ve "acil durumda 112" notu;
  - araç detayında o aracın talepleri.
- **Panel:** `/yonetim/talepler` (tür ve durum süzgeci) ve detay (durum ilerletme, not, atanan kişi). Özet'te "bekleyen talepler" kartı (V2-25'teki alan dolar).
- **E-posta:** durum değişikliği e-postası V2-44'te; burada olay kaydı yeterli.

## Kabul kriterleri
- [ ] Üç türde talep açılır; türe uymayan `details` 422 döner (test).
- [ ] Geçersiz geçiş 409; müşteri yalnızca `RECEIVED` durumundaki talebi iptal edebilir (test).
- [ ] Başka şirketin talebi 404.
- [ ] e2e: Filom'da yol yardım talebi → panelde "Yönlendirildi" → "Yolda" → Filom'da zaman çizelgesi güncel.
- [ ] 375/1280 ekran görüntüsü; axe temiz; konum izni reddinde form kullanılabilir.
- [ ] **V2-25'ten devreden (unutma):** `GET /admin/summary`'deki `serviceRequests` artık `null` değil, açık (kapanmamış) talepleri sayar (`apps/api/src/admin/admin-summary.service.ts`). Özet'teki "Açık servis talebi" kartı görünür ve `/yonetim/talepler?durum=acik` bağlantısı çalışır. `openapi.yaml`, `mocks/admin.ts` ve iki test dosyası (`admin-summary.integration.spec.ts`, `tests/admin-summary.test.ts`) güncellenir.

## Etiketler
`faz-10` `ozellik` `P2` `api` `web` `veritabani`
