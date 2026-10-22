# Novera Mobility: Tasarım Sistemi (DESIGN)

> Durum: **v2.0** · 22 Ekim 2026. Bölüm 1–7, v1 SPEC'in §5'inden (v0.11) olduğu gibi taşındı; v1'in tüm ekranları bu kurallarla yapıldı. Bölüm 8 v2'de eklenen panel ekranlarının kurallarıdır.
> Token değerlerinin tek kaynağı `apps/web/app/globals.css`. Bu belge ile CSS çelişirse CSS'teki değer geçerlidir, bu belge düzeltilir.
> Ürün kapsamı [SPEC.md](SPEC.md), mimari [ARCHITECTURE.md](ARCHITECTURE.md).


> G'nin yönlendirmesi: marka rengi doğa yeşili; tipografi modern ve kurumsal; sade ve net ama düz değil; orantılı boşluklar; akılda kalacak öğe güven odaklı. 10 Ekim: v0.3 paleti "yapay zekâ tarzı" bulundu; yeşil kalarak renk teorisine uyan, daha doğal bir palet seçildi (§1) ve sayfa zemini varsayılan olarak beyaz oldu.

## 1. Renk

**Palet: Zeytin ve Ege (v0.4, G'nin seçimi, 10 Ekim 2026).** v0.3'teki krem kâğıt zemin, terrakota vurgu ve koyu temadaki parlak nane yeşili, yapay zekâ üretimi arayüzlerin en tanıdık kalıbıydı; site "hazır şablon" gibi okunuyordu. Yeni palet Anadolu manzarasından geliyor: zeytin yeşili, kireçtaşı nötrler ve Ege mavisi.

**Ana renk: zeytin `#45561D`.** Sarıya çekik, doygunluğu düşük bir yeşil. Hem doğa vurgusunu (SPEC'in ilk kararı) hem güveni taşır; beyaz üzerinde 8.1:1, yani buton zemini ve metin olarak kullanılabilir.

**Nötrler: kireçtaşı.** Grilere çok az zeytin karışır; metin ve çizgiler markanın ailesinden olur ama renkli görünmez. **Sayfa zemini beyazdır** (G'nin kararı); derinlik kireçtaşı paneller (`stone-100`) ve ince çizgilerle verilir.

**Vurgu: Ege mavisi `#1C6A8A`.** Renk çemberinde zeytinin karşı tarafına yakın (ayrık tamamlayıcı uyum). Yalnızca öne çıkması gereken birkaç şeyde kullanılır: "En çok tercih edilen" rozeti, küçük işaretler, koyu banttaki vurgu. Butonlar zeytin kalır.

| Token | Hex | Kullanım |
|---|---|---|
| `olive-950` | `#1A1C16` | Ana metin |
| `olive-900` | `#262B1B` | Koyu bant (Yol Boyu Güvence) |
| `olive-800` | `#323F13` | Seçili durumda metin |
| `olive-750` | `#384717` | Birincil buton hover |
| `olive-700` | `#45561D` | **Ana marka rengi**, birincil buton, link, odak halkası |
| `olive-600` | `#566B25` | Koyu temada birincil buton |
| `olive-500` | `#627A2B` | Koyu temada buton hover |
| `olive-300` | `#B5C97E` | Koyu temada link, odak, vurgu metni |
| `olive-100` | `#E5EBD3` | Seçili durum zemini, metin seçimi |
| `stone-700` | `#4A4D40` | İkincil metin |
| `stone-600` | `#62655A` | Yardımcı metin, placeholder |
| `stone-500` | `#868979` | Form kenarlığı (beyaz üzerinde 3.58:1, WCAG 1.4.11 için en az 3:1) |
| `stone-300` | `#DCDCD3` | Ayırıcı çizgi, kart kenarlığı |
| `stone-100` | `#F3F3EF` | Hafif bölüm ve panel zemini |
| `stone-50` | `#EEEFE8` | Koyu zeminde metin |
| `white` | `#FFFFFF` | Sayfa, kart ve form zemini |
| `aegean-700` | `#1C6A8A` | Vurgu (ikon, nokta, çizgi) |
| `aegean-900` | `#154F67` | Vurgu zemininde metin |
| `aegean-300` | `#8FC3DA` | Koyu zeminde vurgu |
| `aegean-100` | `#DCEEF5` | Vurgu rozet zemini |
| `error` | `#B42318` | Hata |
| `warning` | `#9A6700` | Uyarı |
| `success` | `olive-700` | Başarı (marka rengiyle aynı, ayrı yeşil eklenmez) |

**Ölçülen kontrastlar (WCAG):** beyaz/`olive-700` 8.07 · beyaz/`olive-750` 10.09 · `olive-950`/beyaz 17.19 · `stone-700`/`stone-100` 7.78 · `stone-600`/beyaz 5.95 · `stone-600`/`stone-100` 5.35 · `aegean-900`/`aegean-100` 7.50 · beyaz/`aegean-700` 6.04 · `stone-50`/`olive-900` 12.57 · `aegean-300`/`olive-900` 7.61 · `error`/beyaz 6.57 · `warning`/beyaz 4.87. Hepsi AA (4.5:1) üstünde; kenarlık 3:1 üstünde.

**Koyu tema** (kullanıcı seçerse ya da "sistem" seçilip sistem koyuysa): zemin `#13140F`, kart `#1C1E17`, metin `stone-50`, birincil buton `olive-600`, link ve odak `olive-300`, vurgu `aegean-300`. Ölçülen: metin/zemin 15.99 · ikincil metin `#BBBEAF` 9.78 · yardımcı metin `#979A8B` 6.44 · link 10.24 · beyaz/`olive-600` 5.96 · beyaz/`olive-500` (hover) 4.84 · form kenarlığı `#757968` kart üzerinde 3.76. Saf siyah kullanılmaz. Değerlerin tamamı `apps/web/app/globals.css` içinde.

**Tarayıcı yüzeyleri:** metin seçimi (`olive-100` üzerinde `olive-800`), imleç ve form kontrollerinin vurgu rengi paletten gelir; tarayıcı varsayılanında kalmaz.

## 2. Tipografi

**Manrope**, tek aile, değişken font (ağırlık 400–800).

- Neden: Geometrik ama soğuk değil; harf aralıkları açık, küçük boyutta okunaklı. Teknoloji ağırlıklı bir mobilite markasına modern, kurumsal sitede ciddi duruyor. Rakamları net; fiyat ve sayaçlarda tablo rakamı (`font-variant-numeric: tabular-nums`) kullanılır, fiyatlar kaymadan hizalanır.
- Neden tek aile: tek değişken font dosyası, iki ayrı aileden daha az indirme demek. Hafif site, sürdürülebilirlik anlatısıyla da tutarlı.
- Türkçe: ç, ğ, ı, İ, ö, ş, ü ve ₺ glifleri font dosyasında doğrulandı.
- Lisans: SIL Open Font License, ücretsiz.

| Rol | Boyut (mobil → masaüstü) | Ağırlık | Satır yüksekliği |
|---|---|---|---|
| Display (hero başlığı) | 36 → 56px | 700 | 1.1 |
| H1 | 30 → 44px | 700 | 1.15 |
| H2 | 24 → 32px | 700 | 1.2 |
| H3 | 20 → 24px | 600 | 1.3 |
| Gövde | 16 → 17px | 400 | 1.6 |
| Küçük | 14px | 500 | 1.5 |
| Etiket / buton | 15px | 600 | 1 |

Gövde metni en fazla ~68 karakter genişliğinde tutulur.

## 3. Boşluk ve şekil

- **Boşluk ölçeği:** 4px tabanlı: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Orantı kuralı: bir öğenin içindeki boşluk, öğeler arasındaki boşluktan her zaman küçük (kart içi 24 → kartlar arası 32 → bölümler arası 96).
- **Bölümler arası:** mobil 64px, masaüstü 96–128px.
- **Izgara:** 4 sütun (mobil, 16px kenar boşluğu) · 8 sütun (tablet) · 12 sütun (masaüstü, en fazla 1200px içerik genişliği).
- **Köşe yarıçapı:** form ve buton 10px, kart 16px, büyük görsel 24px, anahtar (toggle) tam yuvarlak.
- **Gölge:** neredeyse yok. Derinlik gölgeyle değil zemin tonu farkıyla (paper → beyaz kart) verilir; sadece açılan menülerde, pencerelerde, arama alanında ve yüzen navbar hapında (v0.5) hafif gölge.
- **Kırılma noktaları:** 375 (tasarım buradan başlar) · 768 · 1280.

## 4. Yerleşim konsepti: "sade, ama düz değil"

- Sadelik az öğeden gelir: her bölümün tek bir görevi ve tek bir birincil butonu var.
- "Düz değil" hissi ritimden gelir, süsten değil:
  - Bölümler her zaman ortalanmış değil; metin solda / görsel sağda, sonraki bölümde tam genişlik, sonra koyu bant. Göz her bölümde aynı kalıba alışmaz.
  - Sayfa akışında bir kez **koyu zeytin bant** (`olive-900`) kullanılır: Yol Boyu Güvence bölümü. Açık sayfada tek koyu bölüm, dikkati oraya toplar.
  - Büyük, kenarları yuvarlatılmış fotoğraflar; araç fotoğraflarında doğal ışık ve açık hava.
- **Hareket:** varsayılan olarak yalnızca durum değişikliğini anlatan geçişler (anahtar değişince alanın yumuşak geçişi, pencere açılıp kapanması). Kaydırınca beliren dekoratif animasyon yok.
  - **İstisnalar (v0.3, G'nin onayı):** iş birlikleri şeridi (v0.7: kendiliğinden akar, üzerine gelince/odaklanınca durur), Yol Boyu Güvence adımları (görününce bir kez sırayla dolar, sonra durur; v0.7, G: Framer "StepProgress"; v0.6'daki akan iz kalktı), nav ve footer linklerinde harf hover'ı, ürün kartlarının hover'ı, Smart Contact Link balonu, sosyal ikonların büyümesi, göz çiftinin imleci izlemesi, Hakkımızda sayaçları ve **Sürdürülebilirlik rakamları** (görününce bir kez sayar; v0.7: yüzdeler 0'dan tam puanlarla sayar), Hikayemiz zaman çizelgesi (seçim değişince geçiş), SSS'nin yaylı açılması, galeri slayt geçişi.
  - Kendiliğinden başlayan bir geçiş yok: galeri ve zaman çizelgesini kullanıcı ilerletir.
  - `prefers-reduced-motion` açıksa hareketli her şey durur ya da anında geçer.

## 5. Akılda kalacak tek öğe: Yol Boyu Güvence

Hakkımızda metnindeki "Sadece Araç Kiralamıyoruz, Yol Boyu Güvence Sunuyoruz" cümlesi markanın güven vaadi. Bu vaat sitede **somut bir bileşene** dönüşür:

- **Ana sayfada:** iş birliklerinden sonra, koyu yeşil bantta, bir aksilik anının senaryosu olarak anlatılır: *Yolda kaldın → tek dokunuşla SOS → GPS ile en yakın çekici yönlendirilir → 7/24 operasyon masası seni arar → arıza 24 saati aşarsa yedek araç kapında.* İkon kartları değil, soldan sağa (mobilde yukarıdan aşağı) ilerleyen tek bir zaman çizgisi.
- **Karar anlarında tekrar:** rezervasyon özetinde ve ödeme ekranında aynı güvencenin kısa bir şerit hâli ("Bu kiralama Yol Boyu Güvence kapsamında: 7/24 destek, çekici, yedek araç"). Kullanıcı tam para öderken güven mesajını görür.
- **Şeffaf fiyat:** rezervasyon özetinde tüm kalemler açık yazılır, "gizli ücret yok" ibaresi. Güven sadece söylenmez, fiyat ekranında gösterilir.

## 6. Kaçınılacaklar

Eşit üç sütunlu ikon+başlık+gri metin kartları, gerekçesiz gradient (**tek istisna, v0.7, G:** ürün kartları ve ürün sayfasının hero'su, temanın kendi tonlarından yumuşak bir zeminle; her ürünün kendi tonu vardır), sırası olmayan içeriğe 01/02/03, her bölümde aynı ortalanmış yerleşim, amaçsız animasyon, saf siyah metin, saf gri nötrler.

## 7. Erişilebilirlik ve duyarlılık

**Duyarlılık taraması (v0.10, 17 Ekim):** sitenin her sayfası (genel, giriş yapmış bireysel ve kurumsal, sonuç listesi ve ızgarası, filtre paneli, şehir listesi, rezervasyon, ödeme; Türkçe ve İngilizce) 320, 375, 414, 600, 768, 1024 ve 1280 px'te açıldı; yatay taşma, ekran dışına çıkan öğe ve 44 px'ten küçük dokunma hedefi arandı. Bulunanlar düzeltildi: 320 px'te üst çubuk 4 px taşıyordu, sosyal ikon etiketleri sayfa genişliğini artırıyordu (görünmez etiket de genişlik sayılır; artık sola açılır), 768 px'te yatay araç satırının orta sütunu sıkışıyordu, şehir rozetlerinin kaldır düğmesi 32 px'ti. `e2e/responsive.spec.ts` bunların dönmemesi için 14 sayfayı 320/414/768/1024 px'te yana kayma açısından sınar. Alt bilgideki bloklar sayfa kaydırılıp ekrana gelene kadar %97 boyutundadır (yumuşak giriş); bu geçici durum dokunma hedefi sayılmaz.

WCAG 2.2 AA. Metin kontrastı en az 4.5:1, dokunma hedefi en az 44×44px, görünür odak halkası (`olive-700`, koyu temada `olive-300`; 2px, 2px boşluk), tüm akışlar klavyeyle tamamlanabilir, anahtar (Bireysel/Kurumsal) ekran okuyucuda seçili durumu bildirir. Hareketli bileşenler durdurulabilir ve `prefers-reduced-motion`'a uyar (§4). Pencereler odağı içeride tutar, Esc ile kapanır ve kapanınca odağı açan öğeye geri verir.


## 8. Panel ekranları (v2)

Yönetim paneli (`/yonetim`, [ADMIN.md](ADMIN.md)) ve Filom (`/filom`, [FLEET.md](FLEET.md)) aynı token'ları kullanır; ayrı tema, ayrı renk ya da ayrı yazı tipi yoktur.

- **Öncelikli genişlik:** Yönetim paneli 1280 px (çalışan masaüstünde kullanır), Filom 375 px'ten başlar (filo yöneticisi telefondan da bakar). İkisi de 375/768/1280'de yatay sayfa kaydırması üretmez; geniş tablo kendi kutusunda yatay kayar.
- **Yerleşim:** xl'de solda ikonlu dikey menü, daha dar ekranda üstte açılır menü. İçerik alanında sayfa başlığı, en fazla **bir** birincil düğme (ör. "Yeni bayi"), sonra liste ya da form. Profil kabuğuyla (v1) aynı dil.
- **Tablolar:** başlık satırı `bg-surface`, satır ayırıcı `border-border`, sayılar `tabular-nums` ve sağa hizalı, durum çipleri metinli (yalnız renkle durum anlatılmaz). Sıralanabilir başlıkta `aria-sort`.
- **Durum renkleri:** başarı `success`, uyarı `warning`, hata `error`; nötr durum `fg-muted`. `primary` yalnızca dolgu içindir, durum göstergesi olarak kullanılmaz (v1 kuralı, koyu temada kontrast).
- **Formlar:** v1'in `Field` bileşeni; etiket üstte, hata alanın altında. İki dilli alanlar TR/EN sekmeli tek bileşendir. Uzun formlar bölümlere ayrılır, kaydet düğmesi formun sonunda ve sabit değildir.
- **Onay pencereleri:** geri alınamayan işlemde (iptal, kapatma, hesap kapatma) düğme işlemin adını taşır ("Bayiyi kapat"), varsayılan odak "Vazgeç"tedir.
- **Grafikler (Filom raporları):** sade çubuk ve çizgi; renkler marka paletinden (`olive`, `aegean`, `stone`), en çok dört seri. Her grafiğin altında aynı verinin tablosu vardır.
- **Harita (canlı takip, şarj istasyonları):** pin renkleri durum metniyle birlikte gösterilir; harita yüklenmezse liste görünümü aynı bilgiyi verir. Simülasyon verisi her ekranda "Simülasyon" rozetiyle işaretlenir (`bg-accent-soft`, `text-on-accent-soft`).
- **Boş durumlar:** ne olduğunu ve sonraki adımı söyler ("Henüz bayi yok. İlk bayiyi ekleyin.") ve varsa tek birincil düğme taşır.
