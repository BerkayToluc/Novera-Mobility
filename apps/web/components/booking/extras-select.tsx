"use client";

import { useTransition } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "@/i18n/navigation";
import type { Money } from "@/lib/currency";
import type { Extra } from "@/lib/extra";
import { formatMoney } from "@/lib/price";

// The extras of the booking summary (SPEC §2.3). The choice lives in the address (`ek`), so a
// tick asks the server for the price again and the total on the page is always the one the
// server worked out, never one added up here.
export function ExtrasSelect({
  extras,
  selected,
  query,
}: {
  extras: Extra[];
  selected: string[];
  // The booking's address parameters, kept as they are apart from the extras.
  query: Record<string, string>;
}) {
  const t = useTranslations("BookingSummary.extras");
  const format = useFormatter();
  const locale = useLocale() as "tr" | "en";
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(slug: string, on: boolean) {
    const next = on ? [...selected, slug] : selected.filter((item) => item !== slug);
    const { ek: previous, ...rest } = query;
    void previous;
    startTransition(() => {
      router.replace(
        { pathname: "/rezervasyon", query: { ...rest, ...(next.length ? { ek: next.join(",") } : {}) } },
        { scroll: false },
      );
    });
  }

  const money = (value: Money) => formatMoney(format, value);

  return (
    <ul
      aria-busy={pending}
      className="divide-y divide-border rounded-card border border-border bg-surface px-4 aria-busy:opacity-70"
    >
      {extras.map((extra) => (
        <li key={extra.slug} className="flex flex-col justify-between gap-1 py-1 md:flex-row md:items-center md:gap-4">
          <Checkbox checked={selected.includes(extra.slug)} onChange={(event) => toggle(extra.slug, event.target.checked)}>
            {extra.name[locale]}
          </Checkbox>
          <span className="pl-8 text-small tabular-nums text-fg-muted md:pl-0">
            {t(extra.pricing === "PER_DAY" ? "perDay" : "fixed", { price: money(extra.price) })}
          </span>
        </li>
      ))}
    </ul>
  );
}
