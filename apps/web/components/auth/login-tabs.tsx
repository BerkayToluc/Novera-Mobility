import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { AccountType } from "@/lib/session";

const TABS = ["individual", "corporate"] as const satisfies readonly AccountType[];

// The two sign-in tabs (SPEC §2.9). The choice lives in the address (`?tip=kurumsal`) so a link
// can open either; each tab is a real link, not script, hence "current page" and not an ARIA
// tablist. `next` is kept so the payment page's way back survives a switch.
export async function LoginTabs({ current, next }: { current: AccountType; next?: Record<string, string> }) {
  const t = await getTranslations("Auth.login");

  return (
    <nav aria-label={t("tabsLabel")}>
      <ul className="grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-muted p-1">
        {TABS.map((tab) => (
          <li key={tab}>
            <Link
              href={{
                pathname: "/giris",
                query: { ...next, ...(tab === "corporate" ? { tip: "kurumsal" } : {}) },
              }}
              replace
              aria-current={tab === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-label transition-colors",
                tab === current ? "bg-primary text-on-primary" : "text-fg hover:bg-surface",
              )}
            >
              {t(tab)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
