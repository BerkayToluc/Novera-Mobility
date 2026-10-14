import { getTranslations } from "next-intl/server";
import { PARTNERS } from "@/lib/partners";
import { LogoCarousel } from "./logo-carousel";
import { PartnerLogo } from "./partner-logo";

// The partner strip (SPEC §2.2.4): the fictional partners' wordmarks on a slowly turning drum
// (LogoCarousel, after the Framer "Logo 3D Carousel"). It moves on its own and eases to a stop
// under the pointer or with keyboard focus inside it; with reduced motion it stands still.
export async function PartnerStrip() {
  const t = await getTranslations("Partners");

  return (
    <section aria-labelledby="partners-title" className="flex flex-col gap-8">
      <header className="flex max-w-2xl flex-col gap-3">
        <h2 id="partners-title" className="text-h2 text-fg">
          {t("title")}
        </h2>
        <p className="text-body text-fg-muted">{t("intro")}</p>
      </header>
      <LogoCarousel label={t("label")} items={PARTNERS.map((partner) => <PartnerLogo key={partner.id} partner={partner} />)} />
    </section>
  );
}
