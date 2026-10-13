import { getTranslations } from "next-intl/server";
import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { COMPANY, SOCIAL_NETWORKS, telHref } from "@/lib/company";
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

// Simple Footer (SPEC §2.8, after the Framer component): brand on the left (43%), link columns on
// the right, a thin bottom strip; below xl the links come first and the brand after them. A link
// shows a small arrow when pointed at, and each block eases into view as the page scrolls to it. Light on purpose: the Road Assurance band is the page's one dark
// section (SPEC §5.4), and a dark footer right after it would read as a second.
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Header");

  return (
    <footer className="border-t border-border bg-surface-muted text-fg">
      <div className="mx-auto flex max-w-content flex-col gap-16 px-4 py-16 md:px-8 xl:flex-row xl:justify-between xl:gap-16 xl:py-20">
        <FooterReveal kind="block" className="order-2 flex flex-col gap-4 xl:order-1 xl:w-[43%]">
          <Link href="/" aria-label={nav("homeLabel")} className="inline-flex min-h-11 items-center self-start">
            <Logo className="h-9 w-auto" />
          </Link>
          {/* Capped to a readable line length (SPEC §5.2). */}
          <p className="max-w-sm text-body text-fg-muted">{t("tagline")}</p>
        </FooterReveal>

        <div className="order-1 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-x-8 xl:order-2 xl:flex-1 xl:grid-cols-3 xl:gap-x-10">
        <FooterReveal kind="text">
        <nav aria-labelledby="footer-explore" className="flex flex-col gap-3">
          <h2 id="footer-explore" className={headingClasses}>
            {t("explore")}
          </h2>
          <ul className="md:grid md:grid-cols-2 md:gap-x-4 xl:block">
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

        <FooterReveal kind="text" className="col-span-2 md:col-span-1">
        <section aria-labelledby="footer-contact" className="flex flex-col gap-3">
          <h2 id="footer-contact" className={headingClasses}>
            {t("contact")}
          </h2>
          <ul>
            <li>
              <a href={`mailto:${COMPANY.email}`} className={linkClasses}>
                {COMPANY.email}
                <FooterArrow />
              </a>
            </li>
            <li>
              <a href={telHref(COMPANY.phone)} className={`${linkClasses} tabular-nums`}>
                {COMPANY.phone}
                <FooterArrow />
              </a>
            </li>
            <li>
              <Link href={{ pathname: "/iletisim", hash: "mesaj" }} className={linkClasses}>
                {t("contactPage")}
                <FooterArrow />
              </Link>
            </li>
          </ul>
        </section>
        </FooterReveal>
        </div>
      </div>

      <div className="border-t border-border">
        <FooterReveal kind="block" className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
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
        </FooterReveal>
      </div>
    </footer>
  );
}
