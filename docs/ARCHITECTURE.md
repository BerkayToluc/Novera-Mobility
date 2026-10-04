# Novera Mobility: Mimari Kararlar (ARCHITECTURE)

> Durum: **Taslak v0.1** · 4 Ekim 2026
> Ekip belirli bir teknoloji tercihi belirtmedi; seçimler SPEC'teki ihtiyaçlara göre yapıldı.
> Her karar *Bağlam / Alternatifler / Sonuç / Ödünleşim* düzeninde. Bir karar değişirse burada güncellenir, eski hali "Değiştirildi" notuyla kalır.
> Sürüm numaraları bilerek yazılmadı: kurulum günü her paketin **güncel kararlı** sürümü kullanılır ve `package.json`'a sabitlenir.

---

## Genel bakış

```
                ┌──────────────────────────┐
  Tarayıcı ───▶ │  apps/web  (Next.js)     │  Sayfalar, arayüz, çok dillilik
                └────────────┬─────────────┘
                             │ HTTPS + JSON (OpenAPI sözleşmesi)
                ┌────────────▼─────────────┐
                │  apps/api  (NestJS)      │  İş kuralları, kimlik doğrulama
                └────────────┬─────────────┘
                             │ Prisma
                ┌────────────▼─────────────┐
                │  PostgreSQL              │  Kalıcı veri
                └──────────────────────────┘
  Google Maps JS API: tarayıcıdan doğrudan (sadece İletişim sayfası)
```

Tek dil: **TypeScript**, frontend'de de backend'de de.

---

## ADR-01 · Tek repo (monorepo), pnpm workspaces

- **Bağlam:** İki kişi, tek ürün. API sözleşmesi iki tarafı da ilgilendiriyor; bir özelliğin frontend ve backend değişikliği aynı PR'da görülebilmeli.
- **Alternatifler:** İki ayrı repo (frontend / backend). Turborepo veya Nx gibi ek araçlar.
- **Sonuç:** Tek repo, `pnpm` workspaces. Yapı: `apps/web`, `apps/api`, `packages/` (ileride paylaşılan tipler için).
- **Ödünleşim:** Herkes tüm kodu görür (öğrenme hedefi için artı). Ek build aracı yok; ihtiyaç doğarsa Turborepo sonradan eklenebilir.

## ADR-02 · Frontend: Next.js (App Router) + TypeScript

- **Bağlam:** Ürün, hizmet ve hakkımızda sayfaları arama motorlarında bulunmalı (SEO). Kiralama akışı etkileşimli. İki dil (TR/EN) URL seviyesinde. G hazır component'ler getirecek; bunların çoğu React tabanlı.
- **Alternatifler:**
  - *Vite + React (SPA):* Basit, ama sayfalar tarayıcıda oluştuğu için SEO zayıf.
  - *Astro:* İçerik sayfalarında çok hızlı, ama kiralama akışı gibi uygulama tarafı ağırlaşınca React kadar doğal değil; hazır component ekosistemi daha dar.
- **Sonuç:** Next.js App Router. İçerik sayfaları statik üretilir, kiralama akışı sunucu ve istemci component'lerinin karışımı.
- **Ödünleşim:** Öğrenme eğrisi SPA'dan dik (sunucu/istemci component ayrımı). Karşılığında SEO, görsel optimizasyonu ve yönlendirme hazır gelir. Belge: [nextjs.org/docs](https://nextjs.org/docs)

## ADR-03 · Stil: Tailwind CSS + tasarım token'ları

- **Bağlam:** SPEC §5'te renk, font, boşluk, köşe yarıçapı tanımlı. Bu değerlerin tek bir yerde durması ve hiçbir component'te ham hex yazılmaması gerekiyor. Hazır component'lerin (ör. shadcn/ui) büyük kısmı Tailwind ile yazılıyor.
- **Alternatifler:** CSS Modules + CSS değişkenleri (sade, ama hazır component'leri uyarlarken her birini baştan yazmak gerekir). styled-components (çalışma zamanı maliyeti, Next.js sunucu component'leriyle uyumu zahmetli).
- **Sonuç:** Tailwind CSS. Token'lar CSS değişkeni olarak tek dosyada tanımlanır ve Tailwind temasına bağlanır. Kural: **component içinde ham renk/boşluk değeri yok**, sadece token sınıfları.
- **Ödünleşim:** HTML'de uzun sınıf listeleri. Karşılığında hazır component'ler neredeyse doğrudan uyarlanır. Belge: [tailwindcss.com/docs](https://tailwindcss.com/docs)

## ADR-04 · Çok dillilik: next-intl

- **Bağlam:** Türkçe ana dil, İngilizce v1'de var. URL yapısı `/` (TR), `/en/...` (EN).
- **Alternatifler:** Next.js'in yerleşik yönlendirmesiyle elle çözüm; i18next.
- **Sonuç:** next-intl. Metinler `messages/tr.json` ve `messages/en.json` dosyalarında. Sayfaya gömülü metin yazılmaz.
- **Ödünleşim:** Her metin bir anahtar üzerinden yazılır, ilk başta yavaş hissettirir; ikinci dil eklemek sonradan dosya doldurmaktan ibaret olur. Belge: [next-intl.dev](https://next-intl.dev/)

## ADR-05 · Backend: NestJS + TypeScript

- **Bağlam:** Ekip "şirkette çalışır gibi" öğrenmek istiyor. Backend REST API sunacak, kimlik doğrulama, rezervasyon, teklif ve bayi verisini yönetecek. API sözleşmesi otomatik belgelenmeli.
- **Alternatifler:**
  - *Express / Fastify:* Hafif ve basit, ama yapı tamamen ekibe kalır; iki kişilik öğrenme projesinde dağınıklığa açık.
  - *Spring Boot (Java) / ASP.NET (C#):* Kurumsal dünyada çok yaygın, ama frontend'le dil paylaşılmaz; tipler iki kez yazılır.
- **Sonuç:** NestJS. Modül yapısı (her alan kendi klasöründe: `branches`, `vehicles`, `reservations`, `auth`...) şirketlerdeki katmanlı mimariyi öğretir. `@nestjs/swagger` ile OpenAPI belgesi koddan üretilir.
- **Ödünleşim:** Express'e göre daha çok kalıp kod (decorator, module, provider). Karşılığında düzen hazır gelir. Belge: [docs.nestjs.com](https://docs.nestjs.com/)

## ADR-06 · Veritabanı: PostgreSQL + Prisma

- **Bağlam:** Veri ilişkisel: kullanıcı → rezervasyon → araç → bayi. Tarih aralığı sorguları (araç müsait mi?) var.
- **Alternatifler:** MongoDB (ilişkisel veri için doğal değil). MySQL (geçerli, ama PostgreSQL'in tarih aralığı ve coğrafi uzantı desteği daha güçlü). TypeORM / Drizzle (Prisma'nın şema dosyası ve migration akışı yeni başlayan için daha okunaklı).
- **Sonuç:** PostgreSQL, ORM olarak Prisma. Geliştirmede veritabanı Docker Compose ile yerelde çalışır; ikiniz de aynı sürümü kullanırsınız.
- **Ödünleşim:** Docker kurulumu gerekir. Prisma'da çok karmaşık sorgular için ham SQL'e inmek gerekebilir. Belge: [prisma.io/docs](https://www.prisma.io/docs)
- **Not:** npm'de Prisma'nın "latest" etiketi şu an bir sürüm adayını (rc) gösteriyor; kurulumda kararlı sürüm seçilmeli.

## ADR-07 · API sözleşmesi önce (contract-first) ve mock

- **Bağlam:** Frontend ve backend asenkron, birbirini beklemeden ilerlemeli.
- **Alternatifler:** Backend bittikçe frontend bağlanır (frontend sürekli bekler). GraphQL (iki kişilik REST ihtiyacı için fazla).
- **Sonuç:**
  1. Her uç nokta önce `docs/api/openapi.yaml` dosyasına yazılır ve PR ile ikiniz onaylarsınız.
  2. Frontend bu dosyadan `openapi-typescript` ile TypeScript tiplerini üretir.
  3. Backend henüz hazır değilken frontend **MSW** (Mock Service Worker) ile sahte cevaplarla çalışır.
  4. Backend hazır olunca mock kapatılır, gerçek API'ye bağlanılır.
- **Ödünleşim:** Başta sözleşme yazmak yavaş gelir; sonradan "backend şunu döndürmüyormuş" sürprizlerini önler. Belgeler: [openapi-ts.dev](https://openapi-ts.dev/), [mswjs.io](https://mswjs.io/)

## ADR-08 · Kimlik doğrulama: e-posta + şifre, httpOnly çerez

- **Bağlam:** Giriş ödemeden hemen önce istenir. Profil sayfası var. Gerçek ödeme yok.
- **Alternatifler:** Auth.js / Clerk gibi hazır servisler (hızlı, ama backend'ci arkadaşın öğrenme hedefini elinden alır). Token'ı `localStorage`'da tutmak (XSS'e açık).
- **Sonuç:** Backend'de e-posta + şifre (şifre `argon2` ile hash'lenir), oturum `httpOnly`, `Secure`, `SameSite` çerezinde.
- **Ödünleşim:** Şifre sıfırlama, oturum yenileme gibi işler elle yazılır. Öğrenme projesi için bilinçli seçim.

## ADR-09 · Harita: Google Maps JavaScript API

- **Bağlam:** G'nin kararı; arkadaşı daha önce Google Cloud API bağlamış.
- **Sonuç:** Bayi verisi (koordinat dahil) backend'den gelir; harita frontend'de `@vis.gl/react-google-maps` ile çizilir. Harita kodu sadece İletişim sayfasında yüklenir.
- **Ödünleşim / dikkat:** Tarayıcıda kullanılan API anahtarı herkes tarafından görülebilir. Google Cloud'da **HTTP referrer kısıtlaması** ve kota sınırı mutlaka konmalı; anahtar repoya yazılmaz, ortam değişkeninde durur. Belge: [developers.google.com/maps/api-security-best-practices](https://developers.google.com/maps/api-security-best-practices)

## ADR-10 · Formlar ve doğrulama: React Hook Form + Zod

- **Bağlam:** Arama, teklif, kayıt, giriş, sahte ödeme formları.
- **Sonuç:** Frontend'de React Hook Form + Zod şemaları. Backend NestJS'in kendi doğrulamasını (class-validator) kullanır; kurallar aynı tutulur.
- **Ödünleşim:** Kurallar iki yerde. İleride `packages/` altında ortak Zod şemasına taşınabilir.

## ADR-11 · Kalite: ESLint, Prettier, Vitest, Playwright, GitHub Actions

- **Sonuç:**
  - Her PR'da GitHub Actions: lint, tip kontrolü, birim testleri, build. Biri kırmızıysa merge yok.
  - Birim testleri: Vitest (web), Jest (api, NestJS varsayılanı).
  - Uçtan uca test: Playwright, SPEC §8'deki akışlar.
  - Commit mesajları: Conventional Commits (`feat:`, `fix:`, `docs:`...).
- **Ödünleşim:** Kurulum günü biraz zaman alır; sonrasında "bende çalışıyordu" tartışmasını bitirir.

## ADR-12 · Yayın

- **Sonuç (öneri, en son karar verilecek):** Web → Vercel. API + PostgreSQL → Render, Railway veya Fly.io gibi bir servis.
- **Dikkat:** Bu servislerin ücretsiz plan koşulları sık değişiyor; **doğrulanmadı**. Yayın fazına gelince güncel koşullara bakılacak.

---

## Klasör yapısı

```
novera/
├─ apps/
│  ├─ web/                  # Next.js
│  │  ├─ app/[locale]/      # Sayfalar (tr, en)
│  │  ├─ components/        # ui/ (temel), sections/ (sayfa bölümleri)
│  │  ├─ messages/          # tr.json, en.json
│  │  ├─ styles/tokens.css  # Tüm tasarım token'ları
│  │  └─ mocks/             # MSW sahte cevaplar
│  └─ api/                  # NestJS
│     ├─ src/<modül>/       # auth, branches, vehicles, reservations, quotes, faq
│     └─ prisma/            # schema.prisma, migrations, seed
├─ docs/
│  ├─ SPEC.md
│  ├─ ARCHITECTURE.md
│  └─ api/openapi.yaml
├─ docker-compose.yml       # Yerel PostgreSQL
├─ CLAUDE.md
└─ .github/
   ├─ workflows/ci.yml
   └─ pull_request_template.md
```

---

## Çalışma düzeni

- **Dal stratejisi:** `main` her zaman çalışır durumda. Her iş için `feat/<kısa-ad>`, `fix/<kısa-ad>` dalı. Doğrudan `main`'e push yok.
- **PR kuralı:** Her PR bir issue'ya bağlı ("Closes #12"), diğer kişi review eder, CI yeşil olmadan merge edilmez.
- **Görev panosu:** GitHub Projects. Sütunlar: Backlog → Bu hafta → Yapılıyor → Review'da → Bitti.
- **Asenkron iletişim:** Haftada bir yazılı durum notu (ne yaptım / ne yapacağım / neye takıldım), proje panosunda veya bir issue'da.
- **Ortam değişkenleri:** `.env` repoya girmez; `.env.example` girer.
