import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrency } from "@/lib/get-currency";
import { getTheme } from "@/lib/get-theme";
import { CurrencyMenu } from "./currency-menu";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";
import { PreferencesMenu } from "./preferences-menu";

// Not sticky on purpose: a fixed bar would cover the focused element when a
// keyboard user tabs down the page (WCAG 2.2 "Focus Not Obscured").
export async function SiteHeader() {
  const t = await getTranslations("Header");
  const theme = await getTheme();
  const currency = await getCurrency();

  return (
    <header className="border-b border-border bg-canvas">
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 md:h-20 md:px-8">
        <Link href="/" aria-label={t("homeLabel")} className="inline-flex min-h-11 shrink-0 items-center">
          <Logo className="h-9 w-auto" />
        </Link>
        <MainNav label={t("navLabel")} className="ml-2 hidden xl:block xl:ml-6" />
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {/* Below md they live in the menu panel, where there is room to label them. The wrapper
              hides them: a display class on the buttons would compete with their own inline-flex. */}
          <div className="hidden items-center gap-1 md:flex">
            <CurrencyMenu initialCurrency={currency} />
            <PreferencesMenu initialTheme={theme} />
          </div>
          {/* Filled so it reads as a button against the page, not as more page (SPEC §2.8).
              No session exists yet (BACKLOG #23/#25), so this is always "Log in". */}
          <Button asChild className="md:ml-2">
            <Link href="/giris">{t("login")}</Link>
          </Button>
          <MobileMenu initialTheme={theme} initialCurrency={currency} />
        </div>
      </div>
    </header>
  );
}
