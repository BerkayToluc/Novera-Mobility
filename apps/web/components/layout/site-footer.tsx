import { getTranslations } from "next-intl/server";
import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { COMPANY, SOCIAL_NETWORKS, telHref } from "@/lib/company";
import { NAV_ITEMS } from "./nav-items";
import { SocialIcon } from "./social-icon";

const LEGAL_ITEMS = [
  { href: "/kvkk", labelKey: "privacy" },
  { href: "/gizlilik-politikasi", labelKey: "privacyPolicy" },
  { href: "/cerez-politikasi", labelKey: "cookies" },
  { href: "/kullanim-sartlari", labelKey: "siteTerms" },
  { href: "/kiralama-kosullari", labelKey: "terms" },
] as const;

const linkClasses = "inline-flex min-h-11 items-center text-body text-fg-muted hover:text-fg hover:underline";
const headingClasses = "text-label text-fg";

// Simple Footer reference (SPEC §2.8): brand on the left, plain link columns on the right,
// a thin bottom strip. Light on purpose: the Road Assurance band is the page's one dark
// section (SPEC §5.4), and a dark footer right after it would read as a second.
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Header");

  return (
    <footer className="border-t border-border bg-surface-muted text-fg">
      <div className="mx-auto grid max-w-content grid-cols-2 gap-x-6 gap-y-12 px-4 py-16 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-x-8 md:px-8 xl:gap-x-16 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] xl:py-20">
        <div className="col-span-2 flex flex-col gap-4 md:col-span-3 xl:col-span-1">
          <Link href="/" aria-label={nav("homeLabel")} className="inline-flex min-h-11 items-center self-start">
            <Logo className="h-9 w-auto" />
          </Link>
          {/* Capped to a readable line length (SPEC §5.2). */}
          <p className="max-w-sm text-body text-fg-muted">{t("tagline")}</p>
        </div>

        <nav aria-labelledby="footer-explore" className="flex flex-col gap-3">
          <h2 id="footer-explore" className={headingClasses}>
            {t("explore")}
          </h2>
          <ul className="md:grid md:grid-cols-2 md:gap-x-4 xl:block">
            {NAV_ITEMS.map(({ href, labelKey }) => (
              <li key={href}>
                <Link href={href} className={linkClasses}>
                  {nav(labelKey)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/rehberler" className={linkClasses}>
                {nav("guides")}
              </Link>
            </li>
            <li>
              <Link href="/yardim" className={linkClasses}>
                {nav("help")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal" className="flex flex-col gap-3">
          <h2 id="footer-legal" className={headingClasses}>
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
            <li>
              <CookiePreferencesButton className={`${linkClasses} text-left`} />
            </li>
          </ul>
        </nav>

        <section aria-labelledby="footer-contact" className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <h2 id="footer-contact" className={headingClasses}>
            {t("contact")}
          </h2>
          <ul>
            <li>
              <a href={`mailto:${COMPANY.email}`} className={linkClasses}>
                {COMPANY.email}
              </a>
            </li>
            <li>
              <a href={telHref(COMPANY.phone)} className={`${linkClasses} tabular-nums`}>
                {COMPANY.phone}
              </a>
            </li>
            <li>
              <Link href={{ pathname: "/iletisim", hash: "mesaj" }} className={linkClasses}>
                {t("contactPage")}
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="text-small text-fg-muted">
            {t("copyright", { year: new Date().getFullYear() })} {t("fiction")}
          </p>

          {/* Shown, not linked (G's decision): the fictional company has no real accounts, so
              there is nothing honest to point at. No hover state, nothing to suggest a click. */}
          <div className="flex items-center gap-4">
            <p className="whitespace-nowrap text-small text-fg-muted">{t("follow")}</p>
            <ul className="flex items-center gap-2">
              {SOCIAL_NETWORKS.map((network) => (
                <li
                  key={network}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border text-fg-muted"
                >
                  <SocialIcon network={network} className="size-4" />
                  <span className="sr-only">{t(`social.${network}`)}</span>
                </li>
              ))}
            </ul>
            <span className="sr-only">{t("followSoon")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
