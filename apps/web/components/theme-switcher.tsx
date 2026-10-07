"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from "@/lib/theme";

type Choice = Theme | "system";

const CHOICES: readonly Choice[] = ["system", "light", "dark"];

// Writes the choice where the server will read it on the next request and applies
// it to the open page immediately, so there is no round trip before the change shows.
function applyChoice(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.setAttribute("data-theme", choice);
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  }
}

export function ThemeSwitcher({ initialTheme }: { initialTheme: Theme | undefined }) {
  const t = useTranslations("ThemeSwitcher");
  const [choice, setChoice] = useState<Choice>(initialTheme ?? "system");

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {CHOICES.map((option) => {
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
            className={`inline-flex min-h-11 items-center rounded-control px-3 text-label ${
              isCurrent ? "bg-selected text-on-selected" : "text-link hover:underline"
            }`}
          >
            {t(option)}
          </button>
        );
      })}
    </div>
  );
}
