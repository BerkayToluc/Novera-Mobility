import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
import { routing } from "@/i18n/routing";
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

export const viewport: Viewport = {
  // Lets the browser paint the canvas in the user's theme before CSS loads.
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <html lang={await locale()}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
