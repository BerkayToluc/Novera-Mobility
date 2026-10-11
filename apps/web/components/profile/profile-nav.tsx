"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { AccountType } from "@/lib/session";

// A corporate account has its own, shorter set of pages (SPEC §2.9).
const TABS = {
  individual: [
    { href: "/profil", labelKey: "account" },
    { href: "/profil/rezervasyonlar", labelKey: "bookings" },
    { href: "/profil/puanlar", labelKey: "points" },
    { href: "/profil/ayarlar", labelKey: "settings" },
  ],
  corporate: [
    { href: "/profil", labelKey: "company" },
    { href: "/profil/teklifler", labelKey: "quotes" },
    { href: "/profil/ayarlar", labelKey: "settings" },
  ],
} as const;

// The profile sub-tabs are real pages (own URL, back button, shareable), so this is
// navigation with a current page, not an ARIA tablist.
export function ProfileNav({ type }: { type: AccountType }) {
  const t = useTranslations("Profile.nav");
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);
  // Whether more tabs wait to the right: the edge fades so the strip does not look cut off.
  const [moreToRight, setMoreToRight] = useState(false);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (list) setMoreToRight(list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
  }, []);

  useEffect(() => {
    // On a phone the current tab may sit past the edge; bring it into view without moving the page.
    currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname, measure]);

  return (
    <nav aria-label={t("label")}>
      {/* Scrolls sideways on a narrow screen instead of wrapping into several rows. */}
      <ul
        ref={listRef}
        onScroll={measure}
        className={cn(
          "flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]",
          moreToRight && "[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]",
        )}
      >
        {TABS[type].map(({ href, labelKey }) => {
          const isCurrent = pathname === href;
          return (
            <li key={href} className="shrink-0">
              <Link
                ref={isCurrent ? currentRef : undefined}
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-4 text-label",
                  isCurrent
                    ? "border-focus text-fg"
                    : "border-transparent text-fg-muted hover:text-fg",
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
