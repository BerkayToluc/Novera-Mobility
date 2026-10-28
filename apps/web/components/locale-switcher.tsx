"use client";

import { useTranslations } from "next-intl";
import { Flag } from "@/components/ui/flags";
import { switcherItemClasses, type SwitcherTone } from "@/components/ui/switcher-item";
import { Link } from "@/i18n/navigation";
import { LANGUAGE_NAMES } from "@/lib/languages";
import { useLocaleLinks } from "@/lib/use-locale-links";

export function LocaleSwitcher({ tone = "default" }: { tone?: SwitcherTone }) {
  const t = useTranslations("LocaleSwitcher");
  const { locales, currentLocale, linkProps } = useLocaleLinks();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1">
        {locales.map((locale) => {
          const isCurrent = locale === currentLocale;
          return (
            <li key={locale}>
              <Link {...linkProps(locale)} className={switcherItemClasses(isCurrent, tone)}>
                <Flag locale={locale} />
                {LANGUAGE_NAMES[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
