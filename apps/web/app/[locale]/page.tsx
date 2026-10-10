import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AudienceSwitch } from "@/components/home/audience-switch";
import { CampaignArt, type CampaignArtKind } from "@/components/home/campaign-art";
import { CampaignGallery, type CampaignSlide } from "@/components/home/campaign-gallery";
import { CorporateQuoteForm } from "@/components/home/corporate-quote-form";
import { FaqSection } from "@/components/home/faq-section";
import { GuaranteeBand } from "@/components/home/guarantee-band";
import { RentalSearchForm } from "@/components/rental/rental-search-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { parseAudience } from "@/lib/audience";
import type { BranchOption } from "@/lib/branch-options";
import { getCurrency } from "@/lib/get-currency";
import { getBranchOptions } from "@/lib/rental-data";

// Anchor of the rental section, so campaign buttons can bring the visitor to the form.
const RENTAL_ANCHOR = "kiralama";

const CAMPAIGNS: { id: CampaignArtKind; href: CampaignSlide["href"] }[] = [
  { id: "weekend", href: { pathname: "/", hash: RENTAL_ANCHOR } },
  { id: "electric", href: "/araclarimiz" },
  { id: "fleet", href: { pathname: "/", query: { tip: "kurumsal" }, hash: RENTAL_ANCHOR } },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage");
  return { description: t("metaDescription") };
}

// Section order of SPEC §2.2: campaigns, the rental box, Road Assurance, FAQ. Partners, the
// app section and the guides join between them with their own work (BACKLOG Y17, Y39, Y40).
export default async function Home({ searchParams }: PageProps<"/[locale]">) {
  const t = await getTranslations("HomePage");
  const audience = parseAudience((await searchParams).tip);
  const corporate = audience === "kurumsal";
  const currency = await getCurrency();

  // Only the fetch sits in the try: not reaching the branches is an expected state with its
  // own message, while a rendering bug should still reach the error boundary. The corporate
  // tab does not need branches.
  let branches: BranchOption[] | null = null;
  if (!corporate) {
    try {
      branches = await getBranchOptions(currency);
    } catch {
      branches = null;
    }
  }

  const slides: CampaignSlide[] = CAMPAIGNS.map(({ id, href }) => ({
    id,
    href,
    title: t(`gallery.slides.${id}.title`),
    text: t(`gallery.slides.${id}.text`),
    cta: t(`gallery.slides.${id}.cta`),
    art: <CampaignArt kind={id} className="size-full" />,
  }));

  return (
    <>
      <div className="mx-auto max-w-content px-4 pt-6 md:px-8 md:pt-8">
        <CampaignGallery slides={slides} />
      </div>

      {/* The page's h1 heads this section, not the gallery: campaigns change, the page is
          about renting a car (SPEC §2.2). Centred, with the audience buttons free-standing. */}
      <section
        id={RENTAL_ANCHOR}
        aria-labelledby="rental-title"
        className="mx-auto flex max-w-content scroll-mt-4 flex-col items-center gap-8 px-4 py-16 md:px-8 xl:py-24"
      >
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 id="rental-title" className="text-display text-fg">
            {t("title")}
          </h1>
          <p className="max-w-prose text-body text-fg-muted">{corporate ? t("corporateIntro") : t("intro")}</p>
        </header>

        <AudienceSwitch value={audience} />

        <div className="w-full max-w-3xl rounded-card border border-border bg-surface p-6 md:p-8">
          {corporate ? (
            <CorporateQuoteForm />
          ) : branches ? (
            <RentalSearchForm branches={branches} />
          ) : (
            <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
              <Button asChild>
                <Link href="/">{t("error.retry")}</Link>
              </Button>
            </StateMessage>
          )}
        </div>
      </section>

      <GuaranteeBand />

      <div className="mx-auto max-w-content px-4 py-16 md:px-8 xl:py-24">
        <FaqSection audience={audience} />
      </div>
    </>
  );
}
