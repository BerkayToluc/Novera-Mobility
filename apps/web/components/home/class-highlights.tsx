import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { Currency, Money } from "@/lib/currency";
import { getVehicles } from "@/lib/fleet-client";
import { formatMoney } from "@/lib/price";

type ClassSummary = { slug: string; name: string; fromPrice: Money };

export async function ClassHighlights({ currency }: { currency: Currency }) {
  const t = await getTranslations("HomePage.classes");
  const format = await getFormatter();
  const locale = (await getLocale()) as "tr" | "en";

  let classes: ClassSummary[] | null;
  try {
    const byClass = new Map<string, ClassSummary>();
    for (const { vehicleClass, dailyPrice } of await getVehicles(currency)) {
      const found = byClass.get(vehicleClass.slug);
      if (!found || dailyPrice.amount < found.fromPrice.amount) {
        byClass.set(vehicleClass.slug, {
          slug: vehicleClass.slug,
          name: vehicleClass.name[locale],
          fromPrice: dailyPrice,
        });
      }
    }
    // Cheapest first, the same order as the fleet page.
    classes = [...byClass.values()].sort((a, b) => a.fromPrice.amount - b.fromPrice.amount);
  } catch {
    classes = null;
  }

  return (
    <section aria-labelledby="classes-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 id="classes-title" className="text-h2 text-fg">
          {t("title")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>
      {classes === null ? (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((item) => (
            <li key={item.slug}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                  <CardDescription className="text-body">
                    {t("from", { price: formatMoney(format, item.fromPrice) })}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline" className="self-start">
        <Link href="/araclarimiz">{t("viewAll")}</Link>
      </Button>
    </section>
  );
}
