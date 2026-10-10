"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { CONTACT_HREF, NAV_ITEMS, NAV_MENUS } from "./nav-items";
import { NavMenu, NavSubList } from "./nav-menu";

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
          // Contact is the way to a person, so it stands apart from the browsing links
          // (SPEC §2.8): outlined, and set off by space rather than sitting in the row.
          const isContact = href === CONTACT_HREF;
          const menu = href in NAV_MENUS ? NAV_MENUS[href as keyof typeof NAV_MENUS] : null;
          if (menu && !vertical) {
            return (
              <li key={href}>
                <NavMenu kind={menu} label={t(labelKey)} isCurrent={isCurrent} />
              </li>
            );
          }
          return (
            <li key={href} className={cn(isContact && (vertical ? "mt-4" : "ml-4 xl:ml-6"))}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isCurrent ? "page" : undefined}
                // cn is clsx only (lib/cn.ts), so each branch sets its own shape and spacing
                // rather than overriding a shared one.
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap transition-colors",
                  vertical ? "w-full text-h3" : "text-label",
                  isContact
                    ? vertical
                      ? "justify-center rounded-control border border-primary px-3"
                      : "rounded-full border border-primary px-4 xl:px-5"
                    : vertical
                      ? "rounded-control px-3"
                      : "rounded-control px-2",
                  isCurrent
                    ? "bg-selected text-on-selected"
                    : cn(isContact ? "text-link" : "text-fg", "hover:bg-selected"),
                )}
              >
                {t(labelKey)}
              </Link>
              {menu && <NavSubList kind={menu} onNavigate={onNavigate} />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
