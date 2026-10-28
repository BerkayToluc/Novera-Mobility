import type { Metadata } from "next";
import { ArrowRight, Check, Minus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CountUp } from "@/components/about/count-up";
import { Button } from "@/components/ui/button";
import { ContactLink } from "@/components/ui/contact-link";
import { Link } from "@/i18n/navigation";
import { COMPANY } from "@/lib/company";
import { PRODUCTS } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { PRODUCT_COVERAGE, SERVICE_ICONS, SERVICE_PLANS } from "@/lib/services-data";

type Service = { title: string; summary: string; points: string[]; steps: string[] };
type Stat = { value: number; unit: string; label: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ServicesPage");
  return pageMetadata({ href: "/hizmetler", title: t("metaTitle"), description: t("metaDescription") });
}

// The services (SPEC §2.5, v0.9, G): the five at a glance as cards; each one told in its own section
// with how it works in three steps and which packages carry it; a few figures; a table of which
// product includes which service; and, last, what to do in an emergency. The Road Assurance band on the home page
// links to one service (?hizmet=1#hizmet-1) and the footer to the overview (the header's Services entry is a plain
// link, SPEC §2.8): each section has its anchor.
export default async function ServicesPage() {
  const t = await getTranslations("ServicesPage");
  const p = await getTranslations("ProductsPage");
  // The five services are content, so they live in the message files with every other string.
  const items = t.raw("items") as Service[];
  const stats = t.raw("stats.items") as Stat[];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-16 px-4 py-12 md:px-8 xl:gap-24 xl:py-20">
      <header className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="text-body text-fg-muted">{t("intro")}</p>
      </header>

      <section aria-label={t("cardsLabel")}>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => {
            const Icon = SERVICE_ICONS[index];
            return (
              <li key={item.title} className="grid">
                <Link
                  href={{ pathname: "/hizmetler", hash: `hizmet-${index + 1}` }}
                  className="group flex flex-col gap-3 rounded-card border border-border bg-surface p-5 transition-[translate,box-shadow,border-color] duration-300 ease-link hover:-translate-y-1 hover:border-primary hover:shadow-float focus-visible:-translate-y-1 motion-reduce:transition-colors md:p-6"
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-control bg-selected text-on-selected">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h2 className="text-h3 text-fg">{item.title}</h2>
                  <p className="text-body text-fg-muted">{item.summary}</p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-1 text-label text-link">
                    {t("detail")}
                    <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="service-stats" className="flex flex-col gap-6">
        <h2 id="service-stats" className="text-h2 text-fg">
          {t("stats.title")}
        </h2>
        <dl className="grid divide-y divide-border rounded-card border border-border bg-surface md:grid-cols-3 md:divide-x md:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 p-6">
              <dd className="text-display tabular-nums text-fg">
                <CountUp value={stat.value} /> <span className="text-h3 text-fg-muted">{stat.unit}</span>
              </dd>
              <dt className="text-body text-fg-muted">{stat.label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-small text-fg-muted">{t("stats.note")}</p>
      </section>

      <div className="flex flex-col gap-12">
        {items.map((item, index) => {
          const Icon = SERVICE_ICONS[index];
          const plans = SERVICE_PLANS[index];
          return (
            <section
              key={item.title}
              id={`hizmet-${index + 1}`}
              aria-labelledby={`hizmet-${index + 1}-title`}
              className="grid scroll-mt-8 gap-8 border-t border-border pt-10 xl:grid-cols-[1fr_1fr] xl:gap-16"
            >
              <div className="flex flex-col gap-4">
                <span className="inline-flex size-11 items-center justify-center rounded-control bg-selected text-on-selected">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h2 id={`hizmet-${index + 1}-title`} className="text-h2 text-fg">
                  {item.title}
                </h2>
                <p className="max-w-prose text-body text-fg-muted">{item.summary}</p>
                <ul className="flex max-w-prose flex-col gap-2 text-body text-fg">
                  {item.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2 pt-2">
                  <p className="text-small text-fg-muted">{t("plansTitle")}</p>
                  <ul className="flex flex-wrap gap-2">
                    {plans.map((plan) => (
                      <li key={plan} className="rounded-full bg-accent-soft px-3 py-1 text-small text-on-accent-soft">
                        {t(`plans.${plan}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-card bg-surface-muted p-6 md:p-8">
                <h3 className="text-h3 text-fg">{t("stepsTitle")}</h3>
                <ol className="flex flex-col gap-5">
                  {item.steps.map((step, stepIndex) => (
                    <li key={step} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-label tabular-nums text-link"
                      >
                        {stepIndex + 1}
                      </span>
                      <p className="pt-1.5 text-body text-fg">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          );
        })}
      </div>

      <section aria-labelledby="service-coverage" className="flex flex-col gap-4">
        <div className="flex max-w-prose flex-col gap-2">
          <h2 id="service-coverage" className="text-h2 text-fg">
            {t("coverage.title")}
          </h2>
          <p className="text-body text-fg-muted">{t("coverage.intro")}</p>
        </div>
        {/* Wide on a phone: it scrolls sideways inside its box, and the box takes focus for the keyboard. It is positioned so the screen-reader-only words in the cells are clipped with it, not left outside the page. */}
        <div
          tabIndex={0}
          role="region"
          aria-label={t("coverage.caption")}
          className="relative overflow-x-auto rounded-card border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <table className="w-full min-w-176 border-collapse text-left text-body">
            <caption className="sr-only">{t("coverage.caption")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-4 text-label text-fg">
                  {t("coverage.service")}
                </th>
                {PRODUCTS.map((product) => (
                  <th key={product.slug} scope="col" className="p-4 align-bottom text-label text-fg">
                    <Link
                      href={{ pathname: "/urunler/[slug]", params: { slug: product.slug } }}
                      className="text-link underline-offset-4 hover:underline"
                    >
                      {p(`items.${product.slug}.title`)}
                      <span className="sr-only"> {t("coverage.seeProduct")}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.title} className="border-b border-border last:border-b-0">
                  <th scope="row" className="p-4 text-body font-semibold text-fg">
                    {item.title}
                  </th>
                  {PRODUCTS.map((product) => {
                    const included = PRODUCT_COVERAGE[product.slug][index];
                    return (
                      <td key={product.slug} className="p-4">
                        {/* A mark and a word, never colour alone (WCAG 1.4.1). */}
                        {included ? (
                          <span className="inline-flex items-center gap-2 text-fg">
                            <Check aria-hidden="true" className="size-5 text-success" />
                            <span className="sr-only">{t("coverage.yes")}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-fg-muted">
                            <Minus aria-hidden="true" className="size-5" />
                            <span className="sr-only">{t("coverage.no")}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="service-emergency"
        className="flex flex-col gap-6 rounded-card bg-band p-6 text-on-band md:p-10 xl:flex-row xl:items-center xl:justify-between"
      >
        <div className="flex max-w-prose flex-col gap-3">
          <h2 id="service-emergency" className="text-h2">
            {t("emergency.title")}
          </h2>
          <p className="text-body text-on-band/90">{t("emergency.text")}</p>
        </div>
        <div className="flex flex-col items-start gap-3 xl:items-end">
          <p className="text-small text-on-band/80">{t("emergency.call")}</p>
          <ContactLink value={COMPANY.sosPhone} className="text-h2 tabular-nums text-band-accent" />
          <Link
            href={{ pathname: "/", hash: "yol-boyu-guvence" }}
            className="inline-flex min-h-11 items-center gap-2 text-label text-band-accent underline-offset-4 hover:underline"
          >
            {t("emergency.guarantee")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <section className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-8">
        <h2 className="text-h3 text-fg">{t("ctaTitle")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("ctaText")}</p>
        <Button asChild size="lg">
          <Link href="/kurumsal-teklif">{t("ctaButton")}</Link>
        </Button>
      </section>
    </div>
  );
}
