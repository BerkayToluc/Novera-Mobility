"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { switcherItemClasses, type SwitcherTone } from "@/components/ui/switcher-item";
import {
  CURRENCIES,
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_MAX_AGE,
  CURRENCY_SYMBOLS,
  type Currency,
} from "@/lib/currency";

// Outside the component: it writes to the document, which is not React state.
// Shared with the header's currency menu so both write the same cookie.
export function saveCurrency(currency: Currency) {
  document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${CURRENCY_COOKIE_MAX_AGE}; samesite=lax`;
}

// The prices on the page come from the server already converted (the backend owns the
// exchange rates, ADR-15), so choosing a currency means asking the server again: the
// choice is written to the cookie the server reads, then the page is refreshed.
export function CurrencySwitcher({
  initialCurrency,
  tone = "default",
}: {
  initialCurrency: Currency;
  tone?: SwitcherTone;
}) {
  const t = useTranslations("CurrencySwitcher");
  const router = useRouter();
  const [choice, setChoice] = useState<Currency>(initialCurrency);

  function choose(currency: Currency) {
    saveCurrency(currency);
    setChoice(currency);
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {CURRENCIES.map((currency) => (
        <button
          key={currency}
          type="button"
          aria-pressed={currency === choice}
          onClick={() => choose(currency)}
          className={switcherItemClasses(currency === choice, tone)}
        >
          <span aria-hidden="true" className="mr-1.5">
            {CURRENCY_SYMBOLS[currency]}
          </span>
          {currency}
        </button>
      ))}
    </div>
  );
}
