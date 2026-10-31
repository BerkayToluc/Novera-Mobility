import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ClientMessages } from "@/components/client-messages";
import { FleetShell } from "@/components/fleet/fleet-shell";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel");
  // Nothing in Filom is for a search engine (docs/FLEET.md §3): not indexed, its links not followed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The gate of every Filom page (ADR-25, docs/FLEET.md §2). Not signed in: to the corporate sign-in, which brings the person back here.
// An individual account or an administrator's: the page does not exist (404), so Filom is not even confirmed to be there. A corporate
// account whose company has no fleet contract gets the empty state and the call for a quote instead of the screens. The real
// protection is the API, which checks the account and the company on every call to /fleet/*; a layout is not drawn again on a move
// between two pages, so a page must not rely on it alone: its data comes from the API, which refuses.
export default function FleetLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages route="filom/layout">
      <FleetGate>{children}</FleetGate>
    </ClientMessages>
  );
}

async function FleetGate({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect({ href: { pathname: "/giris", query: { sonra: "filom", tip: "kurumsal" } }, locale: await getLocale() });
  if (!session || session.type !== "corporate" || session.role !== "customer") notFound();

  if (!session.hasFleet) {
    const t = await getTranslations("FleetPanel.empty");
    return (
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-12 md:px-8 xl:py-16">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <StateMessage title={t("heading")} text={t("text")}>
          <Button asChild>
            <Link href="/kurumsal-teklif">{t("cta")}</Link>
          </Button>
        </StateMessage>
      </div>
    );
  }
  return <FleetShell company={session.company?.name ?? ""}>{children}</FleetShell>;
}
