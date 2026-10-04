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
});
