import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CLAIMS, FOUNDED_YEAR, STATS, TIMELINE } from "@/lib/about-data";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AboutPage");
  return pageMetadata({ href: "/hakkimizda", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function AboutPage() {
  const t = await getTranslations("AboutPage");
  const format = await getFormatter();

  return (
    <div className="mx-auto flex max-w-content flex-col gap-16 px-4 py-12 md:px-8 xl:gap-24 xl:py-20">
      <header className="flex flex-col gap-6">
        <h1 className="text-label text-fg-muted">{t("title")}</h1>
        {/* The brand promise is the headline; the page title above is just its label. */}
        <p className="max-w-4xl text-display text-fg">{t("statement")}</p>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <section className="grid gap-10 md:grid-cols-2 md:gap-16">
        <div className="flex flex-col gap-3">
          <h2 className="text-h2 text-fg">{t("missionTitle")}</h2>
          <p className="max-w-prose text-body text-fg-muted">{t("mission")}</p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-h2 text-fg">{t("visionTitle")}</h2>
          <p className="max-w-prose text-body text-fg-muted">{t("vision")}</p>
        </div>
      </section>

      {/* Static numbers on purpose: SPEC §5.4 allows no decorative animation. */}
      <section aria-label={t("statsLabel")} className="rounded-card bg-surface-muted p-6 md:p-10">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-8 md:gap-x-8 xl:grid-cols-4">
          {STATS.map((stat) => {
            const value =
              stat.key === "years" ? new Date().getFullYear() - FOUNDED_YEAR : stat.value;
            return (
              // The term comes first in the markup (screen readers read "label: number"); the
              // number is shown above it with flex-col-reverse.
              <div key={stat.key} className="flex flex-col-reverse gap-1">
                <dt className="text-small text-fg-muted">{t(`stats.${stat.key}`)}</dt>
                <dd className="text-h1 tabular-nums text-fg">{format.number(value)}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="grid gap-10 xl:grid-cols-[1fr_2fr] xl:gap-16">
        <h2 className="text-h2 text-fg xl:sticky xl:top-8 xl:self-start">{t("timelineTitle")}</h2>
        <ol className="flex flex-col">
          {TIMELINE.map((event) => (
            <li
              key={event.key}
              className="grid gap-1 border-l-2 border-border py-4 pl-6 md:grid-cols-[6rem_1fr] md:gap-6"
            >
              <p className="text-label tabular-nums text-fg-muted">{event.year}</p>
              <div className="flex flex-col gap-1">
                <h3 className="text-h3 text-fg">{t(`timeline.${event.key}.title`)}</h3>
                <p className="max-w-prose text-body text-fg-muted">{t(`timeline.${event.key}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-8">
        <div className="flex max-w-prose flex-col gap-3">
          <h2 className="text-h2 text-fg">{t("sustainabilityTitle")}</h2>
          <p className="text-body text-fg-muted">{t("sustainabilityIntro")}</p>
        </div>
        {/* A ruled list rather than three equal cards (SPEC §5.6): the number leads each row. */}
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {CLAIMS.map((claim) => (
            <li key={claim.key} className="grid gap-2 py-6 md:grid-cols-[14rem_1fr] md:items-baseline md:gap-8">
              <p className="text-h1 tabular-nums text-link">
                {"percent" in claim
                  ? format.number(claim.value, { style: "percent" })
                  : format.number(claim.value)}
              </p>
              <div className="flex max-w-prose flex-col gap-1">
                <p className="text-h3 text-fg">{t(`claims.${claim.key}.label`)}</p>
                <p className="text-body text-fg-muted">{t(`claims.${claim.key}.detail`)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-small text-fg-muted">{t("sustainabilityNote")}</p>
      </section>

      <section className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-10">
        <h2 className="text-h2 text-fg">{t("ctaTitle")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("ctaText")}</p>
        <Button asChild size="lg">
          <Link href="/iletisim">{t("ctaButton")}</Link>
        </Button>
      </section>
    </div>
  );
}
