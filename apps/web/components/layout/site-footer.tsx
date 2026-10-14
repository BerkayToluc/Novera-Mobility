import { getTranslations } from "next-intl/server";
import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { Logo } from "@/components/logo";
import { Eyes } from "@/components/ui/eyes";
import { Link } from "@/i18n/navigation";
import { SOCIAL_NETWORKS } from "@/lib/company";
import { FooterArrow, footerLinkClasses } from "./footer-arrow";
import { FooterReveal } from "./footer-reveal";
import { NAV_ITEMS } from "./nav-items";
import { SocialIcon } from "./social-icon";

const LEGAL_ITEMS = [
  { href: "/kvkk", labelKey: "privacy" },
  { href: "/gizlilik-politikasi", labelKey: "privacyPolicy" },
  { href: "/cerez-politikasi", labelKey: "cookies" },
  { href: "/kullanim-sartlari", labelKey: "siteTerms" },
  { href: "/kiralama-kosullari", labelKey: "terms" },
] as const;

const linkClasses = footerLinkClasses;
const headingClasses = "text-label text-fg";

// Simple Footer (SPEC §2.8, after the Framer component): the brand on the left with a pair of eyes
// that follow the pointer, link columns on the right, a thin bottom strip; below xl the links come
// first and the brand after them. The Explore list runs in two columns so the footer stays short.
// A link shows a small arrow when pointed at, and each block eases into view as the page scrolls
// to it. The contact details are not repeated here (they are on the Contact page, one link away),
// and the social marks have a column of their own. Light on purpose: the Road Assurance band is the
// page's one dark section (SPEC §5.4), and a dark footer right after it would read as a second.
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Header");

  return (
    <footer className="border-t border-border bg-surface-muted text-fg">
      <div className="mx-auto flex max-w-content flex-col gap-14 px-4 py-14 md:px-8 xl:flex-row xl:justify-between xl:gap-16 xl:py-16">
        <FooterReveal kind="block" className="order-2 flex flex-col gap-5 xl:order-1 xl:w-[30%]">
          <Link href="/" aria-label={nav("homeLabel")} className="inline-flex min-h-11 items-center self-start">
            <Logo className="h-9 w-auto" />
          </Link>
          {/* Capped to a readable line length (SPEC §5.2). */}
          <p className="max-w-sm text-body text-fg-muted">{t("tagline")}</p>
          <Eyes />
        </FooterReveal>

        <div className="order-1 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)] md:gap-x-8 xl:order-2 xl:flex-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-x-10">
          <FooterReveal kind="text" className="col-span-2 md:col-span-1">
            <nav aria-labelledby="footer-explore" className="flex flex-col gap-3">
              <h2 id="footer-explore" className={headingClasses}>
                {t("explore")}
              </h2>
              <ul className="grid grid-cols-2 gap-x-4">
                {NAV_ITEMS.map(({ href, labelKey }) => (
                  <li key={href}>
                    <Link href={href} className={linkClasses}>
                      {nav(labelKey)}
                      <FooterArrow />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/rehberler" className={linkClasses}>
                    {nav("guides")}
                    <FooterArrow />
                  </Link>
                </li>
                <li>
                  <Link href="/yardim" className={linkClasses}>
                    {nav("help")}
                    <FooterArrow />
                  </Link>
                </li>
              </ul>
            </nav>
          </FooterReveal>

          <FooterReveal kind="text">
            <nav aria-labelledby="footer-legal" className="flex flex-col gap-3">
              <h2 id="footer-legal" className={headingClasses}>
                {t("legal")}
              </h2>
              <ul>
                {LEGAL_ITEMS.map(({ href, labelKey }) => (
                  <li key={href}>
                    <Link href={href} className={linkClasses}>
                      {t(labelKey)}
                      <FooterArrow />
                    </Link>
                  </li>
                ))}
                <li>
                  <CookiePreferencesButton className={`${linkClasses} text-left`} trailing={<FooterArrow />} />
                </li>
              </ul>
            </nav>
          </FooterReveal>

          {/* Shown, not linked (G's decision): the fictional company has no real accounts, so there
              is nothing honest to point at. No hover state, nothing to suggest a click. */}
          <FooterReveal kind="text">
            <section aria-labelledby="footer-follow" className="flex flex-col gap-3">
              <h2 id="footer-follow" className={headingClasses}>
                {t("follow")}
              </h2>
              <ul>
                {SOCIAL_NETWORKS.map((network) => (
                  <li key={network} className="flex min-h-11 items-center gap-3 text-body text-fg-muted">
                    <SocialIcon network={network} className="size-4 shrink-0" />
                    {t(`social.${network}`)}
                  </li>
                ))}
              </ul>
              <p className="text-small text-fg-muted">{t("followSoon")}</p>
            </section>
          </FooterReveal>
        </div>
      </div>

      <div className="border-t border-border">
        <FooterReveal kind="block" className="mx-auto max-w-content px-4 py-6 md:px-8">
          <p className="text-small text-fg-muted">
            {t("copyright", { year: new Date().getFullYear() })} {t("fiction")}
          </p>
        </FooterReveal>
      </div>
    </footer>
  );
}
