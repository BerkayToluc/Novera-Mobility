import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novera Mobility",
  description: "Kurumsal ve bireysel araç kiralama",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
