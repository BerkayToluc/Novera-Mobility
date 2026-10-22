# V2-25 · Yönetim paneli Özet ekranı

**Faz:** 3 · Panel temeli · **Öncelik:** P2 · **Boyut:** S · **Bağımlı:** V2-24
**Belgeler:** ADMIN.md §3

## Amaç
Yöneticinin panele girince günün durumunu tek bakışta görmesi.

## Kapsam
- **`GET /admin/summary`:** bugün başlayan ve biten kiralama sayısı, son 7 günün rezervasyon sayısı, yanıt bekleyen teklif (`RECEIVED`) ve ele alınmamış mesaj sayısı.
  - Talep sayısı V2-41'de eklenir; alan şimdiden `null` dönebilir.
  - "Bugün" İstanbul saatine göre hesaplanır.
- **Ekran:** kartlar; her kart ilgili listeye süzgeçli bağlantı. Liste ekranı henüz yoksa bağlantı gösterilmez.
- Yükleniyor, hata ve "her şey yolunda" boş durumu.

## Kabul kriterleri
- [ ] Sayılar seed'li veriyle doğru (test: bilinen rezervasyonlarla).
- [ ] İstanbul gece yarısı sınırında doğru gün (test).
- [ ] e2e: Özet açılır, kartlar görünür; axe temiz.
- [ ] 375/1280 ekran görüntüsü.

## Etiketler
`faz-3` `ozellik` `P2` `api` `web`
