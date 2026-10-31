# V2-45 · Canlı ortam tamamlama

**Faz:** 12 · Yayın · **Öncelik:** P1 · **Boyut:** S · **Bağımlı:** V2-23, V2-28 · **Karar:** SPEC §7 analytics

## Amaç
v1'den açık kalan ve v2'nin getirdiği canlı ortam ayarlarını tamamlamak; yedeğin gerçekten geri yüklenebildiğini kanıtlamak.

## Kapsam
- **G (Vercel):**
  - `NEXT_PUBLIC_SITE_URL` (sitemap, canonical, JSON-LD);
  - analytics aracı kararı ve `ANALYTICS_SCRIPT_URL`, `ANALYTICS_WEBSITE_ID`;
  - Blob anahtarının production'da olduğunun kontrolü.
- **Berkay:**
  - **API'nin Render'dan Google Cloud Run'a taşınması** (27 Ekim kararı, ADR-12): `Dockerfile`, DEPLOY.md §4 ve CI'daki imaj derlemesi hazır; servis, gizli değerler, `API_URL` geçişi ve e-posta 28 Ekim'de canlıda doğrulandı (`render.yaml` kaldırıldı). Kalan: Render'daki Novera servisinin ve Blueprint'in silinmesi, UptimeRobot izleyicisinin silinmesi;
  - Google Maps anahtarına alan adı (HTTP referrer) kısıtı ve kota;
  - `API_ACCESS_KEY` Cloud Run (Secret Manager) ve Vercel'de aynı, 32+ karakter ve sızmış olabilecek eski değerden farklı;
  - ilk yönetici hesabı (`pnpm admin:create`, G'nin e-postası) ve G'nin girişi;
  - haftalık `pg_dump` ve boş bir Neon projesine **geri yükleme denemesi**;
  - UptimeRobot izleyicisi (varsa) silindi: Cloud Run'da gerekmez.
- **Belgeler:** DEPLOY.md'deki kontrol listesi ve SECURITY.md'deki yayın listesi işaretlenir, tarih yazılır.

## Kabul kriterleri
- [ ] Canlıda sitemap ve canonical adresleri gerçek alan adını gösteriyor.
- [ ] Başka bir alan adından Maps anahtarı çalışmıyor (deneme notu).
- [ ] Geri yükleme denemesi yapıldı (tarih, süre, satır sayısı özeti issue'da).
- [ ] G yönetici olarak panele girdi.
- [ ] DEPLOY.md ve SECURITY.md kontrol listeleri işaretli.

## Hazırlık (kodla gelen, V2-45 PR'ı)
Bu iş büyük ölçüde canlı ortamda elle yapılır (Vercel, Google Cloud, Neon); PR yalnız bunları kolaylaştırır ve kanıtı tutar. Maddeler **işaretlenmedi**: canlıda sınanıp aşağıdaki tablolar doldurulunca işaretlenir.
- `pnpm check:live --web <site> --api <api>` (`scripts/check-live.mjs`, testi `scripts/live-checks.test.mjs`): sitemap, robots, canonical ve paylaşım adresi, güvenlik başlıkları, API sağlık, anahtarsız istek ve `/docs`. Yerelde gerçek bir `next start` ve üretim kipinde gerçek bir API'ye karşı denendi (anahtarsız `404`, doğru anahtarla `200`, yanlış anahtarla `404`).
- `scripts/row-counts.sql` ve DEPLOY.md §9c: yedeği boş bir Neon projesine geri yükleme adımları ve satır sayısı karşılaştırması.
- DEPLOY.md §9d: Maps anahtarı kısıtının nasıl denendiği.

## Deneme kaydı (canlıda doldurulacak)
| Ne | Sonuç |
|---|---|
| `pnpm check:live` çıktısı (site ve API) | |
| Maps anahtarı başka adreste (`localhost`) denendi: ne oldu | |
| Geri yükleme: tarih | |
| Geri yükleme: `pg_dump` süresi / `pg_restore` süresi | |
| Geri yükleme: tablo sayısı, satır sayıları aynı mı (fark varsa nedeni) | |
| G yönetici olarak panele girdi (tarih) | |
| Render servisi, Blueprint ve UptimeRobot izleyicisi silindi (tarih) | |

## Etiketler
`faz-12` `guvenlik` `P1` `ci`
