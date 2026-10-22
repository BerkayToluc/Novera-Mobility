# V2-43 · Canlı takip simülasyonu

**Faz:** 11 · Canlı takip · **Öncelik:** P2 · **Boyut:** L · **Bağımlı:** V2-36 · **Karar:** SPEC §7 harita
**Belgeler:** SPEC §3.E · FLEET.md §3, §3.1, §4 · ARCHITECTURE ADR-30 · DESIGN.md §8 (harita)

## Amaç
Akıllı Kurumsal Filo'daki "Canlı takip / Canlı GPS ve Telematik" vaadini gerçek cihaz olmadan, açıkça "simülasyon" diye işaretlenmiş biçimde göstermek.

## Kapsam
- **`TrackingRoute` seed'i:** filo şehirlerinin her birinde 2–3 rota. Rotalar çoklu çizgidir (nokta listesi) ve elle hazırlanır; dış servis kullanılmaz.
- **Simülasyon modülü `src/fleet/simulation/`:**
  - girdi: araç kimliği ve 5 dakikalık zaman dilimi;
  - çıktı: konum (rota üzerinde), hız, kontak;
  - tohumlu, deterministik, saf fonksiyon;
  - 08:00–19:00 dışında ve hafta sonu kontak kapalı, araç son noktasında.
- **Uçlar:**
  - `GET /fleet/tracking`: tüm araçlar, son konum, kontak, hız, `updatedAt`, `simulated: true`;
  - `GET /fleet/vehicles/{plate}/route?date=`: o günün 5 dakikalık noktaları, en çok son 7 gün.
- **Ekran `/filom/canli-takip`:**
  - harita (karar: Google Maps; mevcut CSP izinli) ve yanında liste (plaka, personel, kontak, hız, son güncelleme);
  - araç seçilince 24 saatlik rota çizgisi;
  - 30 saniyede bir yenileme; sekme gizliyken yenileme durur;
  - "Simülasyon" rozeti;
  - harita yüklenmezse ya da anahtar yoksa yalnız liste;
  - harita kodu yalnızca bu rotada yüklenir.
- **Erişilebilirlik:** pinler listeyle eşleşir; klavyeyle listeden araç seçilir; harita dekoratif değil ama tek bilgi kaynağı da değildir.

## Kabul kriterleri
- [ ] Simülasyon aynı girdiye aynı çıktıyı verir; mesai dışında kontak kapalı (test).
- [ ] Başka şirketin aracı 404.
- [ ] e2e: liste görünümü ve rozet (harita mock'lanır); 30 sn yenilemede veri değişir (saat ilerletilerek).
- [ ] Harita anahtarı yokken sayfa listeyle çalışır.
- [ ] Ana sayfa ve diğer sayfaların JS yükü değişmedi (`next build` çıktısı).
- [ ] 375/1280 ekran görüntüsü; axe temiz.

## Etiketler
`faz-11` `ozellik` `P2` `api` `web` `veritabani`
