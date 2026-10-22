# V2-15 · Sayfa başına çeviri yükü

**Faz:** 2 · Temel · **Öncelik:** P1 · **Boyut:** M · **Bağımlı:** V2-14
**Bulgular:** QUALITY P-01

## Amaç
`NextIntlClientProvider` `messages` almadığı için her sayfa tüm çeviri dosyalarını tarayıcıya gönderiyor. Bu yaklaşık 129 KB eder; yalnızca hukuki metinler 15 KB. Panel metinleri de eklenince yük daha büyüyecek. Her sayfanın yalnızca istemci bileşenlerinin ihtiyaç duyduğu metni göndermesi.

## Kapsam
- Kök layout'taki provider'a yalnızca her sayfada kullanılan ortak namespace'ler verilir (header, footer, çerez bandı, ortak hata).
- Sayfa ya da bölüm layout'ları kendi istemci bileşenleri için ek bir provider ile yalnızca gereken namespace'leri ekler (ör. kiralama akışı `booking`, profil `profile`).
- Sunucu bileşenleri metni zaten sunucuda çözer; onlar için istemciye metin gönderilmez.
- Panel (`admin`) ve Filom (`fleet-panel`) metinleri yalnızca kendi rotalarında yüklenir. Bu desen bu işte belgelenir ve V2-24 uygular.

## Teknik notlar
- Kod: `apps/web/app/[locale]/layout.tsx:61`, `i18n/messages.ts`.
- next-intl 4'ün `pick`/namespace yaklaşımı kullanılır. Kesin API için next-intl belgesine bakılır; projede `node_modules/next/dist/docs` notu (AGENTS.md) Next için geçerlidir.

## Kabul kriterleri
- [ ] Ana sayfa, `/araclar`, `/urunler/akilli-kurumsal-filo` ve `/profil`'de istemciye giden çeviri boyutu önce/sonra ölçülür (RSC yükünde metin araması ya da `next build` analizi), PR'da tablo halinde.
- [ ] Hiçbir sayfada eksik çeviri hatası yok (e2e tüm sayfalar, iki dil).
- [ ] `legal` namespace'i yalnızca yasal sayfalarda istemciye gider (gerekiyorsa).
- [ ] QUALITY'de P-01 güncel.

## Etiketler
`faz-2` `temel` `P1` `web`
