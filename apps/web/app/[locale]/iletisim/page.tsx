import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactExplorer } from "@/components/contact/contact-explorer";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { BranchDetail } from "@/lib/branch-detail";
import { getBranchDetails } from "@/lib/fleet-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ContactPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ContactPage() {
  const t = await getTranslations("ContactPage");

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI,
  // while a rendering bug should still reach the error boundary.
  let branches: BranchDetail[] | null;
  try {
    branches = await getBranchDetails();
  } catch {
    branches = null;
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      {branches ? (
        // The key is public by design (ARCHITECTURE ADR-09): it is restricted by referrer in
        // Google Cloud, not by hiding it. Empty means the map is simply not offered.
        <ContactExplorer branches={branches} mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} />
      ) : (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href="/iletisim">{t("error.retry")}</Link>
          </Button>
        </StateMessage>
      )}
    </div>
  );
}
