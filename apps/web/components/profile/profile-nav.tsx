"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { AccountType } from "@/lib/session";

// A corporate account has its own, shorter set of pages (SPEC §2.9).
const TABS = {
  individual: [
    { href: "/profil", labelKey: "account" },
    { href: "/profil/rezervasyonlar", labelKey: "bookings" },
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

  return (
    <nav aria-label={t("label")}>
      {/* Scrolls sideways on a narrow screen instead of wrapping into several rows. */}
      <ul className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS[type].map(({ href, labelKey }) => {
          const isCurrent = pathname === href;
          return (
            <li key={href} className="shrink-0">
              <Link
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
