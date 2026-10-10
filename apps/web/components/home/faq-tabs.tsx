"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AUDIENCES, type Audience } from "@/lib/audience";

export type FaqEntry = { id: string; question: string; answer: string };

// The FAQ after two Framer references (SPEC §2.2.5): Spring FAQ Accordion's rows, with a
// plain "Open / Close" word on the right and the open row lifted, and AK FAQ's category
// tabs. Native <details>, so the keyboard, the expanded state and in-page search work without
// script; the spring is CSS (`.faq-row` in globals.css) and stops with reduced motion.
// The set follows the rental box's audience until the visitor picks the other one.
export function FaqTabs({
  entries,
  initial,
}: {
  entries: Record<Audience, FaqEntry[]>;
  initial: Audience;
}) {
  const t = useTranslations("HomePage.faq");
  const [audience, setAudience] = useState<Audience>(initial);
  const items = entries[audience];

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label={t("tabsLabel")}
        options={AUDIENCES.map((value) => ({ value, label: t(`tabs.${value}`) }))}
        value={audience}
        onChange={setAudience}
        className="self-start"
      />

      {items.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-body text-fg-muted">{t("empty.text")}</p>
      ) : (
        // Keyed by audience so switching tabs starts a fresh group with its first row open.
        <div key={audience} className="overflow-hidden rounded-card border border-border bg-surface">
          {items.map((item, index) => (
            <details
              key={item.id}
              // Same name makes the group exclusive: opening one closes the others.
              name={`faq-${audience}`}
              open={index === 0}
              className="faq-row group border-t border-border transition-colors first:border-t-0 open:bg-surface-muted"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 px-5 py-4 marker:hidden hover:bg-surface-muted focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
                <span className="text-body font-semibold text-fg">{item.question}</span>
                {/* The summary already announces expanded or collapsed; this word is for the eyes. */}
                <span aria-hidden="true" className="shrink-0 text-small text-fg-muted">
                  <span className="group-open:hidden">{t("open")}</span>
                  <span className="hidden group-open:inline">{t("close")}</span>
                </span>
              </summary>
              <div className="max-w-prose px-5 pb-5 text-body text-fg-muted">{item.answer}</div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
