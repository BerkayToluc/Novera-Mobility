import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ADMIN_SCREENS } from "@/lib/admin-screens";
import { shownCards } from "@/lib/admin-summary";
import type { AdminSummary } from "@/lib/api-admin";

export async function SummaryCards({ summary }: { summary: AdminSummary }) {
  const t = await getTranslations("Admin.summary");

  return (
    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {shownCards(summary).map(({ key, screen, filter }) => {
        const target = ADMIN_SCREENS.find((entry) => entry.key === screen);
        const link = target?.ready ? { pathname: target.href as "/yonetim", query: filter } : null;
        return (
          <Card key={key} className="flex flex-col gap-2 p-6">
            <dt className="text-label text-fg-muted">{t(`cards.${key}`)}</dt>
            <dd className="text-display text-fg">{summary[key]}</dd>
            {link && (
              <dd>
                <Link href={link} className="inline-flex min-h-11 items-center text-label text-primary underline underline-offset-4">
                  {t("openList")}
                </Link>
              </dd>
            )}
          </Card>
        );
      })}
    </dl>
  );
}
