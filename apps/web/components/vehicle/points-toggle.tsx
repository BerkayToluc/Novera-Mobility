"use client";

import { Coins } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

// "Puanla öde" on the results page (SPEC §2.3): a switch that turns each card's price into points
// plus money. Only for a signed-in individual account paying in lira; anyone else sees a line that
// says what it would take. The choice is `puan=1` in the address, and "Kirala" carries it on.
export function PointsToggle({ balance, on }: { balance: number | null; on: boolean }) {
  const t = useTranslations("ResultsPage.points");
  const format = useFormatter();
  const router = useRouter();
  const current = useSearchParams();

  if (balance === null) {
    return (
      <p className="flex items-center gap-2 self-start text-small text-fg-muted">
        <Coins aria-hidden="true" className="size-4 shrink-0" />
        <Link href="/giris" className="text-link underline underline-offset-4">
          {t("signIn")}
        </Link>
      </p>
    );
  }

  function toggle() {
    const query: Record<string, string> = {};
    current.forEach((value, key) => {
      if (key !== "puan") query[key] = value;
    });
    if (!on) query.puan = "1";
    router.replace({ pathname: "/araclar", query }, { scroll: false });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="inline-flex min-h-11 items-center gap-3 self-start rounded-full border border-border-strong bg-surface px-4 text-label text-fg transition-colors hover:bg-selected"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200",
          on ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-5 rounded-full bg-surface transition-transform duration-200 ease-spring motion-reduce:transition-none",
            on && "translate-x-4",
          )}
        />
      </span>
      {t("label")}
      <span className="text-small font-normal tabular-nums text-fg-muted">{t("balance", { points: format.number(balance) })}</span>
    </button>
  );
}
