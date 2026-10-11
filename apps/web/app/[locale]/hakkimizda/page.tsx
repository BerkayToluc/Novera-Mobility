import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/about/count-up";
import { StoryTimeline } from "@/components/about/story-timeline";
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

      {/* The figures count up once when they scroll into view; reduced motion shows them as they are. */}
      <section aria-label={t("statsLabel")} className="rounded-card bg-surface-muted px-6 py-10 md:px-10 md:py-14">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-y-0 md:divide-x md:divide-border">
          {STATS.map((stat) => {
            const value = stat.key === "years" ? new Date().getFullYear() - FOUNDED_YEAR : stat.value;
            return (
              // The term comes first in the markup (screen readers read "label: number"); the
              // number is shown above it with flex-col-reverse.
              <div key={stat.key} className="flex flex-col-reverse items-center gap-2 text-center md:px-4">
                <dt className="text-small text-fg-muted">{t(`stats.${stat.key}`)}</dt>
                <dd className="text-display text-fg">
                  <CountUp value={value} />
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="story-title" className="flex flex-col gap-8">
        <h2 id="story-title" className="text-h2 text-fg">
          {t("timelineTitle")}
        </h2>
        <StoryTimeline
          milestones={TIMELINE.map((event) => ({
            key: event.key,
            year: event.year,
            title: t(`timeline.${event.key}.title`),
            text: t(`timeline.${event.key}.text`),
          }))}
        />
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
