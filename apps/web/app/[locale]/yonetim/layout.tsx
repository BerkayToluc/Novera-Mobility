import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { ClientMessages } from "@/components/client-messages";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  // Nothing in the panel is for a search engine (docs/ADMIN.md §3): not indexed, its links not followed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The gate of every panel page (ADR-24). Not signed in: to the sign-in page, which brings the person back here. Signed in
// without the role: the page does not exist (404), so the panel is not even confirmed to be there. The role is read from the
// API's own answer; the real protection is the API, which checks it on every call to /admin/*. A layout is not drawn again
// on a move between two panel pages, so a page must not rely on it alone: its data comes from the API, which refuses.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages route="yonetim/layout">
      <AdminGate>{children}</AdminGate>
    </ClientMessages>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect({ href: { pathname: "/giris", query: { sonra: "yonetim" } }, locale: await getLocale() });
  if (session?.role !== "admin") notFound();
  return <AdminShell>{children}</AdminShell>;
}
