import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type Service = { title: string; summary: string; points: string[] };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ServicesPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ServicesPage() {
  const t = await getTranslations("ServicesPage");
  // The five services are content, so they live in the message files with every other string.
  const items = t.raw("items") as Service[];

  return (
    <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-20">
      {/* Intro beside the list on wide screens, stacked on phones (SPEC §5.4: rhythm, not a repeated centred block). */}
      <div className="grid gap-10 xl:grid-cols-[1fr_2fr] xl:gap-16">
        <header className="flex flex-col gap-4 xl:sticky xl:top-8 xl:self-start">
          <h1 className="text-h1 text-fg">{t("title")}</h1>
          <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
        </header>

        <section aria-label={t("listLabel")} className="flex flex-col gap-12">
          <Accordion>
            {items.map((item, index) => (
              // Same `name` makes the group exclusive: opening one closes the others.
              <AccordionItem key={item.title} name="services" title={item.title} open={index === 0}>
                <p className="max-w-prose text-body text-fg-muted">{item.summary}</p>
                <ul className="mt-4 flex flex-col gap-2 text-body text-fg">
                  {item.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                      {point}
                    </li>
                  ))}
                </ul>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-8">
            <h2 className="text-h3 text-fg">{t("ctaTitle")}</h2>
            <p className="max-w-prose text-body text-fg-muted">{t("ctaText")}</p>
            <Button asChild size="lg">
              <Link href="/kurumsal-teklif">{t("ctaButton")}</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
