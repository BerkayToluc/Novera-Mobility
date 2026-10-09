import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";

// Not sticky on purpose: a fixed bar would cover the focused element when a
// keyboard user tabs down the page (WCAG 2.2 "Focus Not Obscured").
export async function SiteHeader() {
  const t = await getTranslations("Header");

  return (
    <header className="border-b border-border bg-canvas">
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 md:h-20 md:px-8">
        <Link href="/" aria-label={t("homeLabel")} className="inline-flex min-h-11 shrink-0 items-center">
          <Logo className="h-9 w-auto" />
        </Link>
        <MainNav label={t("navLabel")} className="ml-2 hidden xl:block xl:ml-8" />
        <div className="ml-auto flex items-center gap-2">
          {/* No session exists yet (BACKLOG #23/#25), so this is always "Log in"; it becomes the profile menu with auth. */}
          <Button asChild variant="outline">
            <Link href="/giris">{t("login")}</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
