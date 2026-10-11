import type { Metadata } from "next";
import { Coins, Hourglass } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link, redirect } from "@/i18n/navigation";
import { getMyPoints } from "@/lib/account-client";
import { POINT_STEP, type PointsAccount } from "@/lib/points";
import { getSession } from "@/lib/session";
import { formatMoney } from "@/lib/price";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile.nav");
  return { title: t("points"), robots: { index: false } };
}

export default async function PointsPage() {
  const t = await getTranslations("Profile.points");
  const format = await getFormatter();
  const session = await getSession();
  if (!session) return null;
  // Points belong to individual accounts (SPEC §2.9).
  if (session.type !== "individual") redirect({ href: "/profil", locale: await getLocale() });

  // Only the fetch sits in the try, so a rendering bug still reaches the error boundary.
  let account: PointsAccount | null;
  try {
    account = await getMyPoints();
  } catch {
    account = null;
  }

  let content;
  if (account === null) {
    content = (
      <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
        <Button asChild>
          <Link href="/profil/puanlar">{t("error.retry")}</Link>
        </Button>
      </StateMessage>
    );
  } else {
    const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "long" });
    content = (
      <>
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center gap-4 rounded-card bg-surface-muted p-6">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface text-link">
              <Coins aria-hidden="true" className="size-6" />
            </span>
            <div>
              <dt className="text-small text-fg-muted">{t("balance")}</dt>
              <dd className="text-display tabular-nums text-fg">{format.number(account.balance)}</dd>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-6">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
              <Hourglass aria-hidden="true" className="size-6" />
            </span>
            <div>
              <dt className="text-small text-fg-muted">{t("pending")}</dt>
              <dd className="text-h1 tabular-nums text-fg">{format.number(account.pending)}</dd>
              <dd className="text-small text-fg-muted">{t("pendingNote")}</dd>
            </div>
          </div>
        </dl>

        <section aria-labelledby="points-history" className="flex flex-col gap-4">
          <h3 id="points-history" className="text-h3 text-fg">
            {t("history")}
          </h3>
          {account.entries.length === 0 ? (
            <StateMessage title={t("empty.title")} text={t("empty.text")}>
              <Button asChild>
                <Link href={{ pathname: "/", hash: "araclarimiz" }}>{t("empty.cta")}</Link>
              </Button>
            </StateMessage>
          ) : (
            <ul className="overflow-hidden rounded-card border border-border bg-surface">
              {account.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 first:border-t-0"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-body text-fg">{t("earnedFor", { number: entry.reservationNumber })}</p>
                    <p className="text-small text-fg-muted">
                      <time dateTime={entry.date}>{date(entry.date)}</time>
                    </p>
                  </div>
                  <p className="shrink-0 text-h3 tabular-nums text-fg">
                    <span className="sr-only">{t("earned")} </span>+{format.number(entry.points)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="points-rules" className="flex flex-col gap-3 rounded-card bg-surface-muted p-6">
          <h3 id="points-rules" className="text-h3 text-fg">
            {t("rules.title")}
          </h3>
          <ul className="flex max-w-prose flex-col gap-2 text-body text-fg-muted">
            <li>{t("rules.earn", { amount: formatMoney(format, POINT_STEP) })}</li>
            <li>{t("rules.credit")}</li>
            <li>{t("rules.cancelled")}</li>
          </ul>
        </section>
      </>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-h2 text-fg">{t("title")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </div>
      {content}
    </section>
  );
}
