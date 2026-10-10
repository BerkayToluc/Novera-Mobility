"use client";

import { useState, type ComponentProps } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { PRODUCTS } from "@/lib/products";

export type NavMenuKind = "products" | "services";

type MenuItem = {
  key: string;
  href: ComponentProps<typeof Link>["href"];
  label: string;
  featured?: boolean;
};

// The entries behind "Ürünler" and "Hizmetler" (SPEC §2.8). Products have their own pages;
// services share one page, so each link opens its item there (?hizmet=N) and scrolls to it.
export function useNavMenuItems(kind: NavMenuKind) {
  const products = useTranslations("ProductsPage");
  const services = useTranslations("ServicesPage");
  const header = useTranslations("Header");

  if (kind === "products") {
    const items: MenuItem[] = PRODUCTS.map((product) => ({
      key: product.slug,
      href: { pathname: "/urunler/[slug]", params: { slug: product.slug } },
      label: products(`items.${product.slug}.title`),
      featured: product.featured,
    }));
    return { allHref: "/urunler" as const, allLabel: header("allProducts"), featuredLabel: products("featuredBadge"), items };
  }

  // Index-based until the services get slugs with their new content (BACKLOG Y23).
  const titles = (services.raw("items") as { title: string }[]).map((item) => item.title);
  const items: MenuItem[] = titles.map((title, index) => ({
    key: String(index + 1),
    href: { pathname: "/hizmetler", query: { hizmet: String(index + 1) }, hash: `hizmet-${index + 1}` },
    label: title,
  }));
  return { allHref: "/hizmetler" as const, allLabel: header("allServices"), featuredLabel: "", items };
}

// Desktop: the menu title opens a panel of links. A button rather than a link, so one click
// always does one thing; the overview page is the panel's first entry. Links inside a
// popover, not an ARIA menu: Tab moves through them and Escape closes, as for any panel.
export function NavMenu({
  kind,
  label,
  isCurrent,
}: {
  kind: NavMenuKind;
  label: string;
  isCurrent: boolean;
}) {
  const { allHref, allLabel, featuredLabel, items } = useNavMenuItems(kind);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "group inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-label transition-colors xl:px-3",
          isCurrent ? "bg-selected text-on-selected" : "text-fg hover:bg-selected",
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2" aria-label={label}>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={close}
                className="flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-body text-fg transition-colors hover:bg-surface-muted"
              >
                <span className="flex-1">{item.label}</span>
                {item.featured && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-small text-on-accent-soft">
                    {featuredLabel}
                  </span>
                )}
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-border pt-1">
            <Link
              href={allHref}
              onClick={close}
              className="flex min-h-11 items-center justify-between gap-3 rounded-control px-3 text-label text-link transition-colors hover:bg-selected"
            >
              {allLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// Mobile panel: the title stays a link to the overview and the entries sit indented beneath it,
// all visible at once; a phone menu is already a disclosure, so it needs no second one.
export function NavSubList({ kind, onNavigate }: { kind: NavMenuKind; onNavigate?: () => void }) {
  const { items } = useNavMenuItems(kind);
  return (
    <ul className="mb-2 ml-3 flex flex-col border-l border-border pl-3">
      {items.map((item) => (
        <li key={item.key}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className="inline-flex min-h-11 w-full items-center rounded-control px-3 text-body text-fg-muted transition-colors hover:bg-selected hover:text-fg"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
