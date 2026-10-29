"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type Lang = "tr" | "en";
const LANGS: readonly Lang[] = ["tr", "en"];
export type Bilingual = Record<Lang, string>;

type Props = {
  label: string;
  // The form fields are `<name>.tr` and `<name>.en`.
  name: string;
  value: Bilingual;
  onChange: (value: Bilingual) => void;
  // The message under each language (the form's own, from `fieldErrors`).
  errors?: Partial<Record<Lang, string>>;
  multiline?: boolean;
  maxLength?: number;
};

// One field for a text that exists in both languages (ADMIN.md §3.4): Turkish and English tabs, and both are required.
// A tab with a problem says so in words, and the tab that holds the first problem opens by itself, so an error is
// never hidden behind the other language. Arrow keys move between the tabs (the tabs pattern of the ARIA guide).
export function BilingualField({ label, name, value, onChange, errors, multiline = false, maxLength }: Props) {
  const t = useTranslations("Admin.bilingual");
  const id = useId();
  const [active, setActive] = useState<Lang>("tr");
  const tabRefs = useRef<Record<Lang, HTMLButtonElement | null>>({ tr: null, en: null });

  // When a problem shows up on the other tab, that tab opens; one on the tab already open changes nothing. Worked out while
  // drawing (from what the last drawing saw), not in an effect, so there is no frame with the problem out of sight.
  const firstProblem = LANGS.find((lang) => errors?.[lang]);
  const [seenProblem, setSeenProblem] = useState(firstProblem);
  if (firstProblem !== seenProblem) {
    setSeenProblem(firstProblem);
    if (firstProblem && !errors?.[active]) setActive(firstProblem);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = LANGS.indexOf(active);
    const next =
      event.key === "ArrowRight" ? LANGS[(index + 1) % LANGS.length] : event.key === "ArrowLeft" ? LANGS[(index + LANGS.length - 1) % LANGS.length] : event.key === "Home" ? LANGS[0] : event.key === "End" ? LANGS[LANGS.length - 1] : null;
    if (!next) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  const Control = multiline ? Textarea : Input;

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-label text-fg">
        {label}
      </span>
      <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-1 border-b border-border">
        {LANGS.map((lang) => {
          const selected = lang === active;
          return (
            <button
              key={lang}
              ref={(node) => {
                tabRefs.current[lang] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${lang}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${lang}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(lang)}
              onKeyDown={onKeyDown}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-label transition-colors",
                selected ? "border-focus text-fg" : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {t(lang)}
              {errors?.[lang] && <span className="text-error">({t("missing", { language: t(lang) })})</span>}
            </button>
          );
        })}
      </div>
      {LANGS.map((lang) => {
        const error = errors?.[lang];
        const errorId = error ? `${id}-error-${lang}` : undefined;
        return (
          <div
            key={lang}
            role="tabpanel"
            id={`${id}-panel-${lang}`}
            aria-labelledby={`${id}-tab-${lang}`}
            hidden={lang !== active}
            className="flex flex-col gap-2"
          >
            <label htmlFor={`${id}-${lang}`} className="sr-only">
              {label}, {t(lang)}
            </label>
            <Control
              id={`${id}-${lang}`}
              name={`${name}.${lang}`}
              lang={lang}
              value={value[lang]}
              maxLength={maxLength}
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={[`${id}-hint`, errorId].filter(Boolean).join(" ")}
              onChange={(event) => onChange({ ...value, [lang]: event.target.value })}
            />
            {error && (
              <p id={errorId} className="text-small text-error">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <p id={`${id}-hint`} className="text-small text-fg-muted">
        {t("required")}
      </p>
    </div>
  );
}
