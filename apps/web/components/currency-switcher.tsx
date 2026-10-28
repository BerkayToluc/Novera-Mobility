"use client";

import { useTranslations } from "next-intl";
import { switcherItemClasses, type SwitcherTone } from "@/components/ui/switcher-item";
import { CURRENCIES, CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";
import { useCurrencyChoice } from "@/lib/use-currency-choice";

// The mobile menu's currency choice: three toggle buttons (the logic is in useCurrencyChoice).
export function CurrencySwitcher({
  initialCurrency,
  tone = "default",
}: {
  initialCurrency: Currency;
  tone?: SwitcherTone;
}) {
  const t = useTranslations("CurrencySwitcher");
  const { choice, choose } = useCurrencyChoice(initialCurrency);

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
