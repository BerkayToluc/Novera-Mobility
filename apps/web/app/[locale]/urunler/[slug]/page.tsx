import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  BatteryCharging,
  CalendarRange,
  Car,
  Gauge,
  Gem,
  Headset,
  LayoutDashboard,
  Leaf,
  MapPin,
  Smartphone,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ProductArt } from "@/components/products/product-art";
import { ProductTile } from "@/components/products/product-tile";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isProductSlug, PRODUCTS, type ProductSlug } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/urunler/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isProductSlug(slug)) return {};
  const t = await getTranslations("ProductsPage");
  return pageMetadata({
    href: { pathname: "/urunler/[slug]", params: { slug } },
    title: t(`items.${slug}.title`),
    description: t(`items.${slug}.concept`),
  });
}

// One icon per highlight, in the order of the highlights in the message files.
const HIGHLIGHT_ICONS: Record<ProductSlug, LucideIcon[]> = {
  "akilli-kurumsal-filo": [Car, LayoutDashboard, MapPin],
  "vip-mobilite": [Gem, UserRound, Headset],
  "esnek-kisa-donem": [CalendarRange, Zap, Smartphone],
  "yesil-filo": [Leaf, BatteryCharging, Gauge],
};

// The hero's wash matches the product's card (SPEC §2.5).
const HERO_TONE = {
  olive: "from-selected to-surface",
  aegean: "from-accent-soft to-surface",
  stone: "from-surface-muted to-surface",
  leaf: "from-selected via-surface to-accent-soft",
} as const;

type Highlight = { title: string; text: string };
type TechPoint = { title?: string; text: string };

// A product page (SPEC §2.5): a hero on the product's wash with its drawing, what you get as three
// highlights, the technology as numbered points beside a quote card that stays in view from xl,
// then the other three products.
export default async function ProductDetailPage({
  params,
}: PageProps<"/[locale]/urunler/[slug]">) {
  const { slug } = await params;
  if (!isProductSlug(slug)) notFound();

  const t = await getTranslations("ProductsPage");
  const product = PRODUCTS.find((entry) => entry.slug === slug)!;
  const highlights = t.raw(`items.${slug}.highlights`) as Highlight[];
  // The technology points are content, so they sit in the message files with the rest of the text.
  // A point may have a bold lead ("Novera Admin Paneli Dahil") before its sentence.
  const points = t.raw(`items.${slug}.tech.points`) as TechPoint[];
  const techNote = t.has(`items.${slug}.tech.note`) ? t(`items.${slug}.tech.note`) : null;
  const others = PRODUCTS.filter((entry) => entry.slug !== slug);
  const quoteHref = { pathname: "/kurumsal-teklif", query: { urun: slug } } as const;
  const icons = HIGHLIGHT_ICONS[slug];

  return (
    <div className="mx-auto flex max-w-content flex-col gap-16 px-4 py-10 md:px-8 xl:gap-24 xl:py-16">
      <div className="flex flex-col gap-6">
        <Button asChild variant="ghost" className="-ml-3 self-start">
          <Link href="/urunler">← {t("backToList")}</Link>
        </Button>

        <header
          className={cn(
            "grid items-center gap-8 overflow-hidden rounded-card border border-border bg-linear-to-br p-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:p-10 xl:p-14",
            HERO_TONE[product.tone],
          )}
        >
          <div className="flex flex-col items-start gap-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface/70 px-3 py-1 text-small text-fg">
              <span aria-hidden="true" className={cn("size-2 rounded-full", product.featured ? "bg-accent" : "bg-primary")} />
              {t(`items.${slug}.badge`)}
            </span>
            <h1 className="text-h1 text-fg">{t(`items.${slug}.title`)}</h1>
            <p className="max-w-prose text-body text-fg">{t(`items.${slug}.concept`)}</p>
            <p className="text-small text-fg-muted">
              <span className="font-semibold text-fg">{t("idealForLabel")}:</span> {t(`items.${slug}.idealFor`)}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <Link href={quoteHref}>{t("quoteButton")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={{ pathname: "/urunler/[slug]", params: { slug }, hash: "neler-var" }}>{t("whatYouGetHeading")}</Link>
              </Button>
            </div>
          </div>
          <ProductArt slug={slug} className="mx-auto w-full max-w-72 md:max-w-none" />
        </header>
      </div>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:gap-16">
        <div className="flex flex-col gap-16">
          <section id="neler-var" aria-labelledby="what-title" className="flex scroll-mt-28 flex-col gap-6">
            <div className="flex max-w-prose flex-col gap-2">
              <h2 id="what-title" className="text-h2 text-fg">
                {t("whatYouGetHeading")}
              </h2>
              <p className="text-body text-fg-muted">{t(`items.${slug}.whatYouGet`)}</p>
            </div>
            <ul className="grid gap-4 md:grid-cols-3">
              {highlights.map((item, index) => {
                const Icon = icons[index] ?? Car;
                return (
                  <li key={item.title} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
                    <span className="inline-flex size-11 items-center justify-center rounded-control bg-selected text-on-selected">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <h3 className="text-h3 text-fg">{item.title}</h3>
                    <p className="text-body text-fg-muted">{item.text}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="tech-title" className="flex flex-col gap-6 rounded-card bg-surface-muted p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="tech-title" className="text-h2 text-fg">
                {t("techHeading")}
              </h2>
              {techNote && <span className="rounded-full bg-accent-soft px-3 py-1 text-small text-on-accent-soft">{techNote}</span>}
            </div>
            <ol className={cn("grid gap-6", points.length > 1 && "md:grid-cols-2")}>
              {points.map((point, index) => (
                <li key={point.title ?? point.text} className="flex gap-4">
                  <span aria-hidden="true" className="text-h3 tabular-nums text-link">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-body text-fg">
                    {point.title && <strong className="block font-semibold">{point.title}</strong>}
                    {point.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* The quote link carries the product so the quote form can pre-fill it. */}
        <aside className="flex h-fit flex-col items-start gap-4 rounded-card border border-border bg-surface p-6 shadow-float md:p-8 xl:sticky xl:top-28">
          <h2 className="text-h3 text-fg">{t("ctaTitle")}</h2>
          <p className="text-body text-fg-muted">{t("ctaText")}</p>
          <Button asChild size="lg" className="w-full">
            <Link href={quoteHref}>{t("quoteButton")}</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href={{ pathname: "/iletisim", hash: "mesaj" }}>{t("helpContact")}</Link>
          </Button>
        </aside>
      </div>

      <section aria-labelledby="others-title" className="flex flex-col gap-6">
        <h2 id="others-title" className="text-h2 text-fg">
          {t("otherHeading")}
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {others.map((entry) => (
            <li key={entry.slug} className="grid">
              <ProductTile slug={entry.slug} headingAs="h3" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
