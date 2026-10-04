import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
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
    title: t("title"),
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
  return (
    <html lang={await locale()} data-theme={await getTheme()}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
