import { getTranslations } from "next-intl/server";
import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { Logo } from "@/components/logo";
import { Eyes } from "@/components/ui/eyes";
import { Link } from "@/i18n/navigation";
import { WavyText, footerLinkClasses } from "./footer-link";
import { FooterReveal } from "./footer-reveal";
import { NAV_ITEMS } from "./nav-items";
import { SocialLinks } from "./social-links";

const LEGAL_ITEMS = [
  { href: "/kvkk", labelKey: "privacy" },
  { href: "/gizlilik-politikasi", labelKey: "privacyPolicy" },
  { href: "/cerez-politikasi", labelKey: "cookies" },
  { href: "/kullanim-sartlari", labelKey: "siteTerms" },
  { href: "/kiralama-kosullari", labelKey: "terms" },
] as const;

const headingClasses = "text-label text-fg";

// Simple Footer (SPEC §2.8, after the Framer component): the brand with a pair of eyes that follow
// the pointer, link columns, a thin bottom strip. From xl the brand takes the left third and the
// links the rest; below it the links come first, and on a tablet the eyes sit beside the brand's
// words rather than under them. A link's letters wave when it is pointed at (WavyText), and each
// block eases into view as the page scrolls to it. The contact details are not repeated here (the
// Contact page is one link away); the social marks have a column of their own. Light on purpose:
// the Road Assurance band is the page's one dark section (SPEC §5.4).
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Header");

  return (
    <footer className="border-t border-border bg-surface-muted text-fg">
      <div className="mx-auto grid max-w-content gap-14 px-4 pb-12 pt-14 md:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:gap-16 xl:pb-16 xl:pt-20">
        <FooterReveal
          kind="block"
          className="order-2 flex flex-col gap-8 md:flex-row md:items-end md:justify-between xl:order-1 xl:flex-col xl:items-start xl:justify-start"
        >
          <div className="flex flex-col gap-4">
            <Link href="/" aria-label={nav("homeLabel")} className="inline-flex min-h-11 items-center self-start">
              <Logo className="h-9 w-auto" />
            </Link>
            {/* Capped to a readable line length (SPEC §5.2). */}
            <p className="max-w-xs text-body text-fg-muted">{t("tagline")}</p>
          </div>
          <Eyes />
        </FooterReveal>

        <div className="order-1 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] md:gap-x-8 xl:order-2 xl:gap-x-10">
          <FooterReveal kind="text" className="col-span-2 md:col-span-1">
            <nav aria-labelledby="footer-explore" className="flex flex-col gap-4">
              <h2 id="footer-explore" className={headingClasses}>
                {t("explore")}
              </h2>
              <ul className="grid grid-cols-2 gap-x-6">
                {NAV_ITEMS.map(({ href, labelKey }) => (
                  <li key={href}>
                    <Link href={href} className={footerLinkClasses}>
                      <WavyText text={nav(labelKey)} />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/kurumsal-teklif" className={footerLinkClasses}>
                    <WavyText text={nav("corporateQuote")} />
                  </Link>
                </li>
                <li>
                  <Link href="/rehberler" className={footerLinkClasses}>
                    <WavyText text={nav("guides")} />
                  </Link>
                </li>
                <li>
                  <Link href="/yardim" className={footerLinkClasses}>
                    <WavyText text={nav("help")} />
                  </Link>
                </li>
              </ul>
            </nav>
          </FooterReveal>

          <FooterReveal kind="text">
            <nav aria-labelledby="footer-legal" className="flex flex-col gap-4">
              <h2 id="footer-legal" className={headingClasses}>
                {t("legal")}
              </h2>
              <ul>
                {LEGAL_ITEMS.map(({ href, labelKey }) => (
                  <li key={href}>
                    <Link href={href} className={footerLinkClasses}>
                      <WavyText text={t(labelKey)} />
                    </Link>
                  </li>
                ))}
                <li>
                  <CookiePreferencesButton className={`${footerLinkClasses} text-left`} wavy />
                </li>
              </ul>
            </nav>
          </FooterReveal>

          <FooterReveal kind="text">
            <section aria-labelledby="footer-follow" className="flex flex-col gap-4">
              <h2 id="footer-follow" className={headingClasses}>
                {t("follow")}
              </h2>
              <SocialLinks />
              <p className="max-w-56 text-small text-fg-muted">{t("followSoon")}</p>
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
