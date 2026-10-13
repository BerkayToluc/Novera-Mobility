import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BranchExplorer } from "@/components/branches/branch-explorer";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { BranchDetail } from "@/lib/branch-detail";
import { getBranchDetails } from "@/lib/fleet-client";
import { pageMetadata } from "@/lib/seo";
import { branchJsonLd } from "@/lib/structured-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BranchesPage");
  return pageMetadata({ href: "/bayilerimiz", title: t("metaTitle"), description: t("metaDescription") });
}

// SPEC §2.6.1: the branches with a city filter, a search box and the map. They used to sit at the
// foot of the contact page.
export default async function BranchesPage() {
  const t = await getTranslations("BranchesPage");

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
      {/* Each branch is described to search engines as a car rental place (ADR-18). */}
      {branches?.map((branch) => <JsonLd key={branch.id} data={branchJsonLd(branch)} />)}
      <h1 className="text-center text-h1 text-fg">{t("title")}</h1>

      {branches ? (
        // The key is public by design (ARCHITECTURE ADR-09): it is restricted by referrer in
        // Google Cloud, not by hiding it. Empty means the map is simply not offered.
        <BranchExplorer branches={branches} mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} />
      ) : (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href="/bayilerimiz">{t("error.retry")}</Link>
          </Button>
        </StateMessage>
      )}
    </div>
  );
}
