import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactExplorer } from "@/components/contact/contact-explorer";
import { ContactForm } from "@/components/contact/contact-form";
import { Headquarters } from "@/components/contact/headquarters";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { BranchDetail } from "@/lib/branch-detail";
import { getBranchDetails } from "@/lib/fleet-client";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ContactPage");
  return pageMetadata({ href: "/iletisim", title: t("metaTitle"), description: t("metaDescription") });
}

// SPEC §2.6, top to bottom: head office and the teams' addresses beside the contact form, then
// the branches with their filter and map. The form has an anchor so other pages can point to it.
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
    <div className="mx-auto flex max-w-content flex-col gap-16 px-4 py-12 md:px-8 xl:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="flex flex-col gap-10 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start xl:gap-12">
        <Headquarters />
        <section
          id="mesaj"
          aria-labelledby="form-title"
          className="flex scroll-mt-6 flex-col gap-6 rounded-card border border-border bg-surface p-6 md:p-8"
        >
          <header className="flex flex-col gap-2">
            <h2 id="form-title" className="text-h2 text-fg">
              {t("form.title")}
            </h2>
            <p className="text-body text-fg-muted">{t("form.intro")}</p>
          </header>
          <ContactForm />
        </section>
      </div>

      <section aria-labelledby="branches-title" className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h2 id="branches-title" className="text-h2 text-fg">
            {t("branches.title")}
          </h2>
          <p className="max-w-prose text-body text-fg-muted">{t("branches.intro")}</p>
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
      </section>
    </div>
  );
}
