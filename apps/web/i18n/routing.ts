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
    "/araclar/[slug]": { tr: "/araclar/[slug]", en: "/cars/[slug]" },
    "/rezervasyon": { tr: "/rezervasyon", en: "/booking" },
    "/rezervasyon/onay": { tr: "/rezervasyon/onay", en: "/booking/confirmation" },
    "/odeme": { tr: "/odeme", en: "/payment" },
    "/urunler": { tr: "/urunler", en: "/products" },
    "/urunler/[slug]": { tr: "/urunler/[slug]", en: "/products/[slug]" },
    "/hizmetler": { tr: "/hizmetler", en: "/services" },
    "/hakkimizda": { tr: "/hakkimizda", en: "/about" },
    "/iletisim": { tr: "/iletisim", en: "/contact" },
    "/kurumsal-teklif": { tr: "/kurumsal-teklif", en: "/corporate-quote" },
    "/giris": { tr: "/giris", en: "/login" },
    "/kayit": { tr: "/kayit", en: "/register" },
    "/sifre-sifirla": { tr: "/sifre-sifirla", en: "/reset-password" },
    "/profil": { tr: "/profil", en: "/profile" },
    "/kvkk": { tr: "/kvkk", en: "/privacy-notice" },
    "/cerez-politikasi": { tr: "/cerez-politikasi", en: "/cookie-policy" },
    "/kiralama-kosullari": { tr: "/kiralama-kosullari", en: "/rental-terms" },
    // Development-only gallery (404 in production); not translated.
    "/dev/components": "/dev/components",
  },
});
