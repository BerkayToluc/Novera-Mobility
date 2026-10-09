import { getTranslations } from "next-intl/server";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Link } from "@/i18n/navigation";
import { getCurrency } from "@/lib/get-currency";
import { getTheme } from "@/lib/get-theme";
import { NAV_ITEMS } from "./nav-items";

const LEGAL_ITEMS = [
  { href: "/kvkk", labelKey: "privacy" },
  { href: "/cerez-politikasi", labelKey: "cookies" },
  { href: "/kiralama-kosullari", labelKey: "terms" },
] as const;

const linkClasses = "inline-flex min-h-11 items-center text-small text-on-band hover:underline";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Header");
  const theme = await getTheme();
  const currency = await getCurrency();

  return (
    <footer className="bg-band text-on-band">
      <div className="mx-auto grid max-w-content gap-12 px-4 py-16 md:grid-cols-2 md:px-8 xl:grid-cols-4">
        <div className="flex flex-col gap-4 md:col-span-2 xl:col-span-1">
          <Link href="/" aria-label={nav("homeLabel")} className="inline-flex min-h-11 items-center self-start">
            <Logo tone="on-band" className="h-9 w-auto" />
          </Link>
          {/* Capped to a readable line length (SPEC §5.2). */}
          <p className="max-w-prose text-body text-on-band">{t("tagline")}</p>
        </div>

        <nav aria-labelledby="footer-explore" className="flex flex-col gap-2">
          <h2 id="footer-explore" className="text-label text-on-band">
            {t("explore")}
          </h2>
          <ul>
            {NAV_ITEMS.map(({ href, labelKey }) => (
              <li key={href}>
                <Link href={href} className={linkClasses}>
                  {nav(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal" className="flex flex-col gap-2">
          <h2 id="footer-legal" className="text-label text-on-band">
            {t("legal")}
          </h2>
          <ul>
            {LEGAL_ITEMS.map(({ href, labelKey }) => (
              <li key={href}>
                <Link href={href} className={linkClasses}>
                  {t(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4">
          <h2 className="text-label text-on-band">{t("preferences")}</h2>
          <LocaleSwitcher tone="band" />
          <ThemeSwitcher initialTheme={theme} tone="band" />
          <CurrencySwitcher initialCurrency={currency} tone="band" />
        </div>
      </div>

      <div className="border-t border-on-band/20">
        <p className="mx-auto max-w-content px-4 py-6 text-small text-on-band md:px-8">
          {t("copyright", { year: new Date().getFullYear() })} {t("fiction")}
        </p>
      </div>
    </footer>
  );
}
