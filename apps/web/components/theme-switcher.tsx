"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { switcherItemClasses, type SwitcherTone } from "@/components/ui/switcher-item";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, THEMES, type Theme } from "@/lib/theme";

// Writes the choice where the server will read it on the next request and applies
// it to the open page immediately, so there is no round trip before the change shows.
function applyChoice(choice: Theme) {
  document.documentElement.setAttribute("data-theme", choice);
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

export function ThemeSwitcher({
  initialTheme,
  tone = "default",
}: {
  initialTheme: Theme;
  tone?: SwitcherTone;
}) {
  const t = useTranslations("ThemeSwitcher");
  const [choice, setChoice] = useState<Theme>(initialTheme);

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {THEMES.map((option) => {
        const isCurrent = option === choice;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isCurrent}
            onClick={() => {
              applyChoice(option);
              setChoice(option);
            }}
            className={switcherItemClasses(isCurrent, tone)}
          >
            {t(option)}
          </button>
        );
      })}
    </div>
  );
}
