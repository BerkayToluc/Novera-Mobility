"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/profil", labelKey: "account" },
  { href: "/profil/rezervasyonlar", labelKey: "bookings" },
  { href: "/profil/ayarlar", labelKey: "settings" },
] as const;

// The profile sub-tabs are real pages (own URL, back button, shareable), so this is
// navigation with a current page, not an ARIA tablist.
export function ProfileNav() {
  const t = useTranslations("Profile.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      {/* Scrolls sideways on a narrow screen instead of wrapping into several rows. */}
      <ul className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(({ href, labelKey }) => {
          const isCurrent = pathname === href;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-4 text-label",
                  isCurrent
                    ? "border-primary text-fg"
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
