"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, CalendarRange, Coins, FileText, Plus, Settings, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { AccountType } from "@/lib/session";

// A corporate account has its own, shorter set of pages (SPEC §2.9).
const TABS = {
  individual: [
    { href: "/profil", labelKey: "account", icon: UserRound },
    { href: "/profil/rezervasyonlar", labelKey: "bookings", icon: CalendarRange },
    { href: "/profil/puanlar", labelKey: "points", icon: Coins },
    { href: "/profil/ayarlar", labelKey: "settings", icon: Settings },
  ],
  corporate: [
    { href: "/profil", labelKey: "company", icon: Building2 },
    { href: "/profil/teklifler", labelKey: "quotes", icon: FileText },
    { href: "/profil/ayarlar", labelKey: "settings", icon: Settings },
  ],
} as const;

// The profile pages are real pages (own URL, back button, shareable), so this is navigation with
// a current page, not an ARIA tablist. From xl it is a column beside the page, with the way to a
// new rental under it (v0.8); below xl it is a row of tabs that scrolls sideways on a narrow screen.
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
    <div className="flex flex-col gap-6 xl:sticky xl:top-8 xl:self-start">
      <nav aria-label={t("label")}>
        <ul
          ref={listRef}
          onScroll={measure}
          className={cn(
            "flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] xl:flex-col xl:gap-1 xl:overflow-visible xl:border-b-0",
            moreToRight && "[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] xl:[mask-image:none]",
          )}
        >
          {TABS[type].map(({ href, labelKey, icon: Icon }) => {
            const isCurrent = pathname === href;
            return (
              <li key={href} className="shrink-0">
                <Link
                  ref={isCurrent ? currentRef : undefined}
                  href={href as "/profil"}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-label transition-colors xl:w-full xl:rounded-control xl:border-b-0 xl:px-3",
                    isCurrent
                      ? "border-focus text-fg xl:bg-selected xl:text-on-selected"
                      : "border-transparent text-fg-muted hover:text-fg xl:hover:bg-surface-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {type === "individual" && (
        <Button asChild className="max-xl:hidden">
          <Link href={{ pathname: "/", hash: "kiralama" }}>
            <Plus aria-hidden="true" className="size-4" />
            {t("newRental")}
          </Link>
        </Button>
      )}
    </div>
  );
}
