"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Each language is named in its own language so a visitor who cannot read the
// current one still recognises theirs. These names are deliberately not translated.
const LANGUAGE_NAMES = {
  tr: "Türkçe",
  en: "English",
} as const satisfies Record<(typeof routing.locales)[number], string>;

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const currentLocale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1">
        {routing.locales.map((locale) => {
          const isCurrent = locale === currentLocale;
          return (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                lang={locale}
                hrefLang={locale}
                aria-current={isCurrent ? "true" : undefined}
                className={`inline-flex min-h-11 items-center rounded-control px-3 text-label ${
                  isCurrent ? "bg-selected text-on-selected" : "text-link hover:underline"
                }`}
              >
                {LANGUAGE_NAMES[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
