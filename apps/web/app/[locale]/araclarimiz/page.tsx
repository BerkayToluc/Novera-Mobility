import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { VehicleCard } from "@/components/vehicle/vehicle-card";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { Money } from "@/lib/currency";
import { getCurrency } from "@/lib/get-currency";
import { getVehicles } from "@/lib/fleet-client";
import type { Vehicle } from "@/lib/vehicle";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPage");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

type FleetModel = { vehicle: Vehicle; fromPrice: Money; branchCount: number };

// The API lists cars (one per branch); the fleet page shows each model once, at the lowest
// daily price among its cars, with how many branches have it.
function groupByModel(vehicles: Vehicle[]): FleetModel[] {
  const models = new Map<string, FleetModel>();
  for (const vehicle of vehicles) {
    const key = `${vehicle.brand} ${vehicle.model}`;
    const found = models.get(key);
    if (!found) {
      models.set(key, { vehicle, fromPrice: vehicle.dailyPrice, branchCount: 1 });
      continue;
    }
    found.branchCount += 1;
    if (vehicle.dailyPrice.amount < found.fromPrice.amount) found.fromPrice = vehicle.dailyPrice;
  }
  return [...models.values()];
}

export default async function FleetPage() {
  const t = await getTranslations("FleetPage");
  const locale = (await getLocale()) as "tr" | "en";
  const currency = await getCurrency();

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI,
  // while a rendering bug should still reach the error boundary.
  let vehicles: Vehicle[] | null;
  try {
    vehicles = await getVehicles(currency);
  } catch {
    vehicles = null;
  }

  // Classes in order of price, so the page reads from the cheapest cars to the dearest.
  const groups = new Map<string, { name: string; models: FleetModel[] }>();
  for (const model of vehicles ? groupByModel(vehicles) : []) {
    const slug = model.vehicle.vehicleClass.slug;
    const group = groups.get(slug) ?? { name: model.vehicle.vehicleClass.name[locale], models: [] };
    group.models.push(model);
    groups.set(slug, group);
  }
  const sections = [...groups.entries()]
    .map(([slug, group]) => ({
      slug,
      ...group,
      models: group.models.sort((a, b) => a.fromPrice.amount - b.fromPrice.amount),
    }))
    .sort((a, b) => a.models[0].fromPrice.amount - b.models[0].fromPrice.amount);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-4">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      {vehicles ? (
        sections.map((section) => (
          <section key={section.slug} aria-labelledby={`class-${section.slug}`} className="flex flex-col gap-6">
            <h2 id={`class-${section.slug}`} className="text-h2 text-fg">
              {section.name}
            </h2>
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {section.models.map(({ vehicle, fromPrice, branchCount }) => (
                <li key={`${vehicle.brand}-${vehicle.model}`}>
                  <VehicleCard
                    vehicle={vehicle}
                    fromPrice={fromPrice}
                    note={t("branches", { count: branchCount })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
          <Button asChild>
            <Link href="/araclarimiz">{t("error.retry")}</Link>
          </Button>
        </StateMessage>
      )}

      <section className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-10">
        <h2 className="text-h2 text-fg">{t("ctaTitle")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("ctaText")}</p>
        <Button asChild size="lg">
          <Link href="/">{t("ctaButton")}</Link>
        </Button>
      </section>
    </div>
  );
}
