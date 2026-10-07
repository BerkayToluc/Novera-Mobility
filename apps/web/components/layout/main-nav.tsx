"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

type MainNavProps = {
  // Accessible name of this <nav>; the header and the mobile panel each have one.
  label: string;
  orientation?: "horizontal" | "vertical";
  // Lets the mobile panel close itself when a link is chosen.
  onNavigate?: () => void;
  className?: string;
};

export function MainNav({ label, orientation = "horizontal", onNavigate, className }: MainNavProps) {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const vertical = orientation === "vertical";

  return (
    <nav aria-label={label} className={className}>
      <ul className={cn("flex", vertical ? "flex-col gap-1" : "items-center gap-1")}>
        {NAV_ITEMS.map(({ href, labelKey }) => {
          // Sub-pages (a vehicle, a product) keep their section highlighted; "/" only matches itself.
          const isCurrent = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-control",
                  vertical ? "w-full px-3 text-h3" : "px-2 text-label xl:px-3",
                  isCurrent ? "bg-selected text-on-selected" : "text-fg hover:bg-selected",
                )}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
