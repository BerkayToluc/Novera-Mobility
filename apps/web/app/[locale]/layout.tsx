import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { routing } from "@/i18n/routing";
import { getTheme } from "@/lib/get-theme";
// Self-hosted variable font: no request to Google at runtime, and unicode-range
// subsets mean only Latin + Latin Extended (Turkish) files are downloaded in practice.
import "@fontsource-variable/manrope/wght.css";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    // Pages set only their own title; the site name is appended here.
    title: { default: t("title"), template: `%s | ${t("title")}` },
    description: t("description"),
  };
}

export async function generateViewport(): Promise<Viewport> {
  // Lets the browser paint the canvas in the user's theme before CSS loads.
  return { colorScheme: (await getTheme()) ?? "light dark" };
}

// Reading the theme cookie makes every route render per request instead of at
// build time (ARCHITECTURE ADR-13): the price of a first paint without a flash.
export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const skipLabel = (await getTranslations("Header"))("skip");

  return (
    <html lang={await locale()} data-theme={await getTheme()}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
