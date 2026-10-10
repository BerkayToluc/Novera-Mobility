"use client";

import { useId, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { FaqTopic } from "@/lib/faq";

export type HelpEntry = { id: string; topic: FaqTopic; question: string; answer: string };

// The help centre (SPEC §2.9): the FAQ's questions grouped by topic, with a search box and
// topic chips. Native <details> as on the home page, so the answers work without script.
// Search runs in the browser over the already-loaded entries; with a few dozen of them there
// is nothing to ask the server.
export function HelpCentre({ entries, topics }: { entries: HelpEntry[]; topics: FaqTopic[] }) {
  const t = useTranslations("HelpPage");
  const locale = useLocale();
  const uid = useId();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<FaqTopic | null>(null);

  // Locale-aware lowercase, so the Turkish dotted and dotless I match what the visitor typed.
  const normalise = (value: string) => value.toLocaleLowerCase(locale);
  const needle = normalise(query.trim());
  const matches = entries.filter(
    (entry) =>
      (topic === null || entry.topic === topic) &&
      (needle === "" || normalise(`${entry.question} ${entry.answer}`).includes(needle)),
  );
  const visibleTopics = topics.filter((value) => matches.some((entry) => entry.topic === value));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <label htmlFor={`${uid}-search`} className="text-label text-fg">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-fg-muted"
          />
          <Input
            id={`${uid}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-11"
          />
        </div>

        <div role="group" aria-label={t("topicsLabel")} className="flex flex-wrap gap-2">
          {[null, ...topics].map((value) => (
            <button
              key={value ?? "all"}
              type="button"
              aria-pressed={topic === value}
              onClick={() => setTopic(value)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-control border px-4 text-label transition-colors",
                topic === value
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-strong bg-surface text-fg hover:bg-surface-muted",
              )}
            >
              {value === null ? t("allTopics") : t(`topics.${value}`)}
            </button>
          ))}
        </div>

        {/* A status region, so a screen-reader user hears the effect of typing. */}
        <p role="status" className="text-small text-fg-muted">
          {t("results", { count: matches.length })}
        </p>
      </div>

      {matches.length === 0 ? (
        <StateMessage tone="empty" title={t("noResults.title")} text={t("noResults.text")}>
          <Link
            href={{ pathname: "/iletisim", hash: "mesaj" }}
            className="inline-flex min-h-11 items-center text-label text-link underline"
          >
            {t("noResults.button")}
          </Link>
        </StateMessage>
      ) : (
        visibleTopics.map((value) => (
          <section key={value} aria-labelledby={`${uid}-${value}`} className="flex flex-col gap-4">
            <h2 id={`${uid}-${value}`} className="text-h2 text-fg">
              {t(`topics.${value}`)}
            </h2>
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              {matches
                .filter((entry) => entry.topic === value)
                .map((entry) => (
                  <details
                    key={entry.id}
                    className="faq-row group border-t border-border transition-colors first:border-t-0 open:bg-surface-muted"
                  >
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 px-5 py-4 marker:hidden hover:bg-surface-muted focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
                      <span className="text-body font-semibold text-fg">{entry.question}</span>
                      <span aria-hidden="true" className="shrink-0 text-small text-fg-muted">
                        <span className="group-open:hidden">{t("open")}</span>
                        <span className="hidden group-open:inline">{t("close")}</span>
                      </span>
                    </summary>
                    <div className="max-w-prose px-5 pb-5 text-body text-fg-muted">{entry.answer}</div>
                  </details>
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
