import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { TrackingView } from "@/components/fleet/tracking-view";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { currentTime } from "@/lib/clock";
import { getFleetRoute, getFleetTracking } from "@/lib/fleet-server";
import { istanbulDate } from "@/lib/simulation";
import { pickDay, pickTracked, type RouteDay, type TrackingList } from "@/lib/tracking";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.tracking");
  return { title: t("title") };
}

export default async function LiveTrackingPage({ searchParams }: PageProps<"/[locale]/filom/canli-takip">) {
  const t = await getTranslations("FleetPanel.tracking");
  const raw = await searchParams;
  const one = (name: string) => (Array.isArray(raw[name]) ? raw[name][0] : raw[name]);

  // Only the fetches sit in the try: a failure to load is an expected state with its own UI.
  let tracking: TrackingList | null;
  try {
    tracking = await getFleetTracking();
  } catch {
    tracking = null;
  }
  // Today is the day the answer is for (the API's own clock; the sample's, in sample mode), so the days offered are the days it will answer.
  const today = istanbulDate(tracking ? Date.parse(tracking.updatedAt) : currentTime());
  const day = pickDay(one("gun"), today);
  const chosen = tracking ? pickTracked(tracking.items, one("arac")) : null;
  let route: RouteDay | null = null;
  if (chosen) {
    try {
      route = await getFleetRoute(chosen.plate, day);
    } catch {
      route = null;
    }
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      {!tracking ? (
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild variant="outline">
            <Link href="/filom/canli-takip">{t("retry")}</Link>
          </Button>
        </StateMessage>
      ) : tracking.items.length === 0 ? (
        <StateMessage title={t("emptyTitle")} text={t("emptyText")}>
          <Button asChild variant="outline">
            <Link href="/filom/araclar">{t("emptyAction")}</Link>
          </Button>
        </StateMessage>
      ) : (
        // A new car or a new day is a new screen: the state (and the clock of the refresh) starts again.
        <TrackingView key={`${chosen?.plate ?? ""}|${day}`} initial={tracking} initialRoute={route} plate={chosen?.plate ?? null} day={day} today={today} mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} />
      )}
    </>
  );
}
