import type { Metadata, Viewport } from "next";
// Self-hosted variable font: no request to Google at runtime, and unicode-range
// subsets mean only Latin + Latin Extended (Turkish) files are downloaded in practice.
import "@fontsource-variable/manrope/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novera Mobility",
  description: "Kurumsal ve bireysel araç kiralama",
};

export const viewport: Viewport = {
  // Lets the browser paint the canvas in the user's theme before CSS loads.
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
