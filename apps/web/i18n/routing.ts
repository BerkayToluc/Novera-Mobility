import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
  // Turkish is the primary language, so it keeps the clean URLs (`/araclar`)
  // and only English carries a prefix (`/en/...`), as the SPEC requires.
  localePrefix: "as-needed",
  // `/` must always be Turkish. Redirecting English-browser visitors away from
  // it would make the primary language depend on browser settings.
  localeDetection: false,
  // Keys are the Turkish paths from SPEC §2.1 and double as the folder names under
  // app/[locale]; English values are what visitors see under `/en`.
  pathnames: {
    "/": "/",
    "/araclar": { tr: "/araclar", en: "/cars" },
    "/bayilerimiz": { tr: "/bayilerimiz", en: "/branches" },
    "/rezervasyon": { tr: "/rezervasyon", en: "/booking" },
    "/rezervasyon/onay": { tr: "/rezervasyon/onay", en: "/booking/confirmation" },
    "/odeme": { tr: "/odeme", en: "/payment" },
    "/urunler": { tr: "/urunler", en: "/products" },
    "/urunler/[slug]": { tr: "/urunler/[slug]", en: "/products/[slug]" },
    "/hizmetler": { tr: "/hizmetler", en: "/services" },
    "/hakkimizda": { tr: "/hakkimizda", en: "/about" },
    "/iletisim": { tr: "/iletisim", en: "/contact" },
    "/yardim": { tr: "/yardim", en: "/help" },
    "/rehberler": { tr: "/rehberler", en: "/guides" },
    "/rehberler/[slug]": { tr: "/rehberler/[slug]", en: "/guides/[slug]" },
    "/kurumsal-teklif": { tr: "/kurumsal-teklif", en: "/corporate-quote" },
    "/giris": { tr: "/giris", en: "/login" },
    "/kayit": { tr: "/kayit", en: "/register" },
    "/sifre-sifirla": { tr: "/sifre-sifirla", en: "/reset-password" },
    "/sifre-sifirla/yeni": { tr: "/sifre-sifirla/yeni", en: "/reset-password/new" },
    "/profil": { tr: "/profil", en: "/profile" },
    "/profil/rezervasyonlar": { tr: "/profil/rezervasyonlar", en: "/profile/bookings" },
    "/profil/puanlar": { tr: "/profil/puanlar", en: "/profile/points" },
    "/profil/teklifler": { tr: "/profil/teklifler", en: "/profile/quotes" },
    "/profil/ayarlar": { tr: "/profil/ayarlar", en: "/profile/settings" },
    // The administration (V2-23; the pages come in V2-24). Only an administrator sees the way in, the API checks the role.
    "/yonetim": { tr: "/yonetim", en: "/admin" },
    "/yonetim/kampanya-kodlari": { tr: "/yonetim/kampanya-kodlari", en: "/admin/promo-codes" },
    "/yonetim/kampanya-kodlari/yeni": { tr: "/yonetim/kampanya-kodlari/yeni", en: "/admin/promo-codes/new" },
    "/yonetim/kampanya-kodlari/[code]": { tr: "/yonetim/kampanya-kodlari/[code]", en: "/admin/promo-codes/[code]" },
    "/kvkk": { tr: "/kvkk", en: "/privacy-notice" },
    "/cerez-politikasi": { tr: "/cerez-politikasi", en: "/cookie-policy" },
    "/kiralama-kosullari": { tr: "/kiralama-kosullari", en: "/rental-terms" },
    "/gizlilik-politikasi": { tr: "/gizlilik-politikasi", en: "/privacy-policy" },
    "/kullanim-sartlari": { tr: "/kullanim-sartlari", en: "/terms-of-use" },
    // Development-only galleries (404 in production); not translated.
    "/dev/components": "/dev/components",
    "/dev/admin": "/dev/admin",
    "/dev/profile": "/dev/profile",
  },
});
