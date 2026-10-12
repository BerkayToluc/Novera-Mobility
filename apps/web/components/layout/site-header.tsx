import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrency } from "@/lib/get-currency";
import { getSession } from "@/lib/session";
import { CurrencyMenu } from "./currency-menu";
import { LanguageMenu } from "./language-menu";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";

// A floating pill (SPEC §2.8, after the Framer "Modern Navbar"): logo, links, then preferences and
// the account. Not sticky on purpose: a fixed bar would cover the focused element when a
// keyboard user tabs down the page (WCAG 2.2 "Focus Not Obscured").
export async function SiteHeader() {
  const t = await getTranslations("Header");
  const currency = await getCurrency();
  const signedIn = (await getSession()) !== null;

  return (
    <header className="px-4 pt-4 md:px-8 md:pt-6">
      <div className="mx-auto flex h-16 max-w-content items-center gap-2 rounded-full border border-border bg-surface px-3 shadow-float md:px-4 xl:gap-4 xl:px-6">
        <Link href="/" aria-label={t("homeLabel")} className="inline-flex min-h-11 shrink-0 items-center px-1">
          <Logo className="h-9 w-auto" />
        </Link>
        <MainNav label={t("navLabel")} className="hidden xl:block" />
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {/* Below md they live in the menu panel, where there is room to label them. The wrapper
              hides them: a display class on the buttons would compete with their own inline-flex. */}
          <div className="hidden items-center gap-1 md:flex">
            <CurrencyMenu initialCurrency={currency} />
            <LanguageMenu />
          </div>
          {signedIn ? (
            // An icon, not a label (SPEC §2.8); the name is for assistive technology.
            <Link
              href="/profil"
              aria-label={t("account")}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-link transition-colors hover:bg-selected"
            >
              <UserRound aria-hidden="true" className="size-5" />
            </Link>
          ) : (
            // Filled so it reads as a button against the page, not as more page (SPEC §2.8).
            <Button asChild shape="pill" className="md:ml-1">
              <Link href="/giris">{t("login")}</Link>
            </Button>
          )}
          <MobileMenu initialCurrency={currency} signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
