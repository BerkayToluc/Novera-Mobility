import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
import { Analytics } from "@/components/analytics";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ROOT_NAMESPACES } from "@/i18n/client-messages";
import { pickNamespaces } from "@/i18n/pick-namespaces";
import { routing } from "@/i18n/routing";
import { BRAND_COLORS } from "@/lib/brand";
import { getConsent } from "@/lib/get-consent";
import { getTheme } from "@/lib/get-theme";
import { socialMetadata } from "@/lib/seo";
import { organizationJsonLd } from "@/lib/structured-data";
import { colorSchemeOf } from "@/lib/theme";
import { SITE_URL } from "@/lib/site-url";
// Self-hosted variable font: no request to Google at runtime, and unicode-range
// subsets mean only Latin + Latin Extended (Turkish) files are downloaded in practice.
import "@fontsource-variable/manrope/wght.css";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  const current = (await getLocale()) as (typeof routing.locales)[number];
  return {
    // Makes the share-preview image and other relative links in metadata absolute.
    metadataBase: new URL(SITE_URL),
    ...socialMetadata({ locale: current, siteName: t("title") }),
    // Pages set only their own title; the site name is appended here.
    title: { default: t("title"), template: `%s | ${t("title")}` },
    description: t("description"),
  };
}

export async function generateViewport(): Promise<Viewport> {
  // Lets the browser paint the canvas in the user's theme before CSS loads.
  return {
    colorScheme: colorSchemeOf(await getTheme()),
    // The address bar's colour follows the page's own background, in both themes.
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: BRAND_COLORS.canvasLight },
      { media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.canvasDark },
    ],
  };
}

// Reading the theme cookie makes every route render per request instead of at
// build time (ARCHITECTURE ADR-13): the price of a first paint without a flash.
export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const skipLabel = (await getTranslations("Header"))("skip");
  const meta = await getTranslations("Metadata");

  return (
    <html lang={await locale()} data-theme={await getTheme()}>
      <body className="flex min-h-dvh flex-col">
        {/* Only what the header, the banner and the error page use; each section adds its own (i18n/client-messages.ts). */}
        <NextIntlClientProvider messages={pickNamespaces(await getMessages(), ROOT_NAMESPACES)}>
          <JsonLd data={organizationJsonLd({ name: meta("title"), description: meta("description") })} />
          <ConsentProvider initial={await getConsent()}>
          {/* First tab stop: lets keyboard users skip the header (WCAG 2.4.1). */}
          <a
            href="#main"
            // `not-sr-only` resets padding, so the box (and its 44px height) is restored on focus.
            className="sr-only rounded-control bg-primary text-label text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4"
          >
            {skipLabel}
          </a>
          <SiteHeader />
          {/* The one <main> landmark of every page; pages render their content inside it. */}
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          </ConsentProvider>
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
