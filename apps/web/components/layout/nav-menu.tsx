"use client";

import { useEffect, useRef, useState, type ComponentProps, type PointerEvent } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SplitText, splitTextGroup } from "@/components/ui/split-text";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { PRODUCTS } from "@/lib/products";

type MenuItem = {
  key: string;
  href: ComponentProps<typeof Link>["href"];
  label: string;
  featured?: boolean;
};

// The entries behind "Ürünler" (SPEC §2.8): each product has its own page.
export function useNavMenuItems() {
  const products = useTranslations("ProductsPage");
  const header = useTranslations("Header");

  const items: MenuItem[] = PRODUCTS.map((product) => ({
    key: product.slug,
    href: { pathname: "/urunler/[slug]", params: { slug: product.slug } },
    label: products(`items.${product.slug}.title`),
    featured: product.featured,
  }));
  return {
    allHref: "/urunler" as const,
    allLabel: header("allProducts"),
    quoteHref: "/kurumsal-teklif" as const,
    quoteLabel: header("getQuote"),
    featuredLabel: products("featuredBadge"),
    items,
  };
}

// Desktop (SPEC §2.8, after the Framer Pill Dropdown Nav): the menu title opens a panel of links,
// on click and also when the pointer rests on it (120 ms in, 200 ms out, so passing over it does
// nothing and moving down into the panel does not close it). The chevron turns, the panel settles
// 10 px below with a short fade, and the entry under the pointer or the focus is highlighted. A button rather than a link, so one click always does one thing; links
// inside a popover, not an ARIA menu: Tab moves through them and Escape closes, as for any panel.
// Opened by hover, the panel leaves the focus where it is; opened by click or key, it takes it.
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

export function NavMenu({
  label,
  isCurrent,
}: {
  label: string;
  isCurrent: boolean;
}) {
  const { allHref, allLabel, quoteHref, quoteLabel, featuredLabel, items } = useNavMenuItems();
  const [open, setOpen] = useState(false);
  const viaHover = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const close = () => setOpen(false);
  // Only a mouse or a pen hovers; a finger's pointerenter comes with the tap and is left to the click.
  const isHover = (event: PointerEvent) => event.pointerType !== "touch";
  const enter = (event: PointerEvent) => {
    if (!isHover(event)) return;
    clearTimeout(timer.current);
    if (open) return;
    timer.current = setTimeout(() => {
      viaHover.current = true;
      setOpen(true);
    }, OPEN_DELAY_MS);
  };
  const leave = (event: PointerEvent) => {
    if (!isHover(event)) return;
    clearTimeout(timer.current);
    if (!viaHover.current) return;
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  const changeOpen = (next: boolean) => {
    clearTimeout(timer.current);
    if (!next) viaHover.current = false;
    setOpen(next);
  };

  const entries = [
    ...items.map((item) => ({ ...item, all: false, quote: false })),
    { key: "all", href: allHref, label: allLabel, featured: false, all: true, quote: false },
    // The corporate quote page is the main conversion page of the corporate side (V2-16, QUALITY U-01).
    { key: "quote", href: quoteHref, label: quoteLabel, featured: false, all: false, quote: true },
  ];

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        onPointerEnter={enter}
        onPointerLeave={leave}
        onClick={(event) => {
          // A click on a panel the pointer has just opened keeps it open and hands it the click.
          if (open && viaHover.current) {
            event.preventDefault();
            viaHover.current = false;
          }
        }}
        className={cn(
          "group inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full px-3 text-label transition-colors",
          splitTextGroup,
          isCurrent || open ? "bg-selected text-on-selected" : "text-fg",
        )}
      >
        <SplitText text={label} />
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform duration-250 ease-menu group-data-[state=open]:rotate-180 motion-reduce:transition-none"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-80 p-2.5"
        aria-label={label}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onOpenAutoFocus={(event) => viaHover.current && event.preventDefault()}
        onCloseAutoFocus={(event) => viaHover.current && event.preventDefault()}
      >
        <ul className="flex origin-top-left animate-menu-in flex-col gap-1 motion-reduce:animate-none">
          {entries.map((entry) => (
            <li key={entry.key} className={cn(entry.all && "mt-1 border-t border-border pt-1")}>
              <Link
                href={entry.href}
                onClick={close}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-control px-3 py-2 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted motion-reduce:transition-none",
                  entry.all || entry.quote ? "justify-between text-label text-link" : "text-body text-fg",
                )}
              >
                <span className="relative flex-1">{entry.label}</span>
                {entry.featured && (
                  <span className="relative shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-small text-on-accent-soft">
                    {featuredLabel}
                  </span>
                )}
                {(entry.all || entry.quote) && <ArrowRight aria-hidden="true" className="relative size-4" />}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// Mobile panel: the title stays a link to the overview and the entries sit indented beneath it,
// all visible at once; a phone menu is already a disclosure, so it needs no second one.
export function NavSubList({ onNavigate }: { onNavigate?: () => void }) {
  const { items, quoteHref, quoteLabel } = useNavMenuItems();
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
      <li>
        <Link
          href={quoteHref}
          onClick={onNavigate}
          className="inline-flex min-h-11 w-full items-center rounded-control px-3 text-label text-link transition-colors hover:bg-selected"
        >
          {quoteLabel}
        </Link>
      </li>
    </ul>
  );
}
