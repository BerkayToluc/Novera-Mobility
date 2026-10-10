import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "./site-url";

// What every public page tells a search engine about itself (ARCHITECTURE ADR-18): its own
// canonical address and where the other language lives, so TR and EN are not read as copies.

type Locale = (typeof routing.locales)[number];

// A path as `i18n/routing.ts` knows it, including dynamic ones with their params.
export type PageHref = Parameters<typeof getPathname>[0]["href"];

const OG_LOCALE: Record<Locale, string> = { tr: "tr_TR", en: "en_US" };

// The address of `href` in `locale`, absolute. The home page is the origin itself, with no
// trailing slash after it. Also what the sitemap lists, so the two cannot drift.
export function localizedUrl(href: PageHref, locale: Locale): string {
  const path = getPathname({ href, locale });
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

// Share previews (Open Graph, X/Twitter). A page that sets `openGraph` replaces the layout's
// object whole instead of merging with it, so every page repeats the shared parts from here.
// The image is the file route in `app/opengraph-image.tsx`; named explicitly because the
// layout's own `openGraph` would otherwise drop it.
export function socialMetadata({ locale, siteName, url }: { locale: Locale; siteName: string; url?: string }) {
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: siteName };
  return {
    openGraph: {
      type: "website" as const,
      siteName,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
      images: [image],
      ...(url && { url }),
    },
    twitter: { card: "summary_large_image" as const, images: [image] },
  } satisfies Pick<Metadata, "openGraph" | "twitter">;
}

// Metadata for a public page. `title` is the page's own (the site name is appended by the
// layout); leave it out on the home page to use the site's. `href` is the page's path key.
export async function pageMetadata({
  href,
  title,
  description,
}: {
  href: PageHref;
  title?: string;
  description: string;
}): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const siteName = (await getTranslations("Metadata"))("title");
  const url = localizedUrl(href, locale);

  return {
    ...(title && { title }),
    description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(routing.locales.map((other) => [other, localizedUrl(href, other)])),
        // Visitors whose language is neither get the primary one.
        "x-default": localizedUrl(href, routing.defaultLocale),
      },
    },
    ...socialMetadata({ locale, siteName, url }),
  };
}
