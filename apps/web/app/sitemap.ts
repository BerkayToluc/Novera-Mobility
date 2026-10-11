import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { PUBLIC_PAGES } from "@/lib/public-pages";
import { localizedUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap((href) =>
    routing.locales.map((locale) => ({
      url: localizedUrl(href, locale),
      // Each entry names its translation, so the two languages are not seen as duplicates.
      alternates: {
        languages: Object.fromEntries(routing.locales.map((other) => [other, localizedUrl(href, other)])),
      },
    })),
  );
}
