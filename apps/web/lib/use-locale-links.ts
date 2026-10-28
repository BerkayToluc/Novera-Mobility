"use client";

import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { LanguageCode } from "./languages";

// What the language switchers share (V2-14, QUALITY M-07): the languages, the current one, and the props of a link to
// the same page in another language (not a cookie, so the address and the language always agree).
export function useLocaleLinks() {
  const currentLocale = useLocale() as LanguageCode;
  const pathname = usePathname();
  // Dynamic routes (e.g. /urunler/[slug]) need their params to build the other language's URL.
  const params = useParams();

  function linkProps(locale: LanguageCode) {
    return {
      // TypeScript cannot relate a runtime pathname to its params; next-intl validates them.
      href: { pathname, params } as never,
      locale,
      lang: locale,
      hrefLang: locale,
      "aria-current": locale === currentLocale ? ("true" as const) : undefined,
    };
  }

  return { locales: routing.locales as readonly LanguageCode[], currentLocale, linkProps };
}
