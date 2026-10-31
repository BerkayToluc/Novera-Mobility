import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { VehicleAssignment } from "@/components/fleet/vehicle-assignment";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { currentTime } from "@/lib/clock";
import { daysUntil, type FleetEmployee, type FleetVehicleDetail } from "@/lib/fleet-panel";
import { getAssignableEmployees, getFleetRequests, getFleetVehicle } from "@/lib/fleet-server";
import { requestTone, type ServiceRequestPage } from "@/lib/requests";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("FleetPanel.vehicle");
  return { title: t("metaTitle") };
}

export default async function FleetVehiclePage({ params }: PageProps<"/[locale]/filom/araclar/[plate]">) {
  const t = await getTranslations("FleetPanel.vehicle");
  const locale = await getLocale();
  const { plate } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still reach the
  // segment's error boundary. A car that does not exist, or is another company's, is a page that does not exist.
  let vehicle: FleetVehicleDetail | null;
  let failed = false;
  try {
    vehicle = await getFleetVehicle(decodeURIComponent(plate));
  } catch {
    vehicle = null;
    failed = true;
  }
  if (!vehicle && !failed) notFound();

  if (!vehicle) {
    return (
      <>
        <PageHeader title={t("metaTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/filom/araclar/[plate]", params: { plate } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  // The people a car can be given to fill the form's choice only; the page still shows without them.
  let employees: FleetEmployee[] = [];
  if (vehicle.status === "ACTIVE" && !vehicle.assignee) {
    try {
      employees = await getAssignableEmployees();
    } catch {
      employees = [];
    }
  }

  const open = vehicle.assignments.find((entry) => entry.endedAt === null) ?? null;
  const day = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Istanbul" });
  const km = new Intl.NumberFormat(locale);
  const today = new Date(currentTime()).toISOString().slice(0, 10);
  // A date to come says how many days; one that has passed says so.
  const due = (value: string | null): string => {
    if (!value) return "—";
    const days = daysUntil(value, today);
    return days < 0 ? t("facts.overdue", { date: day(value) }) : t("facts.inDays", { date: day(value), count: days });
  };

  const facts: Array<[string, string]> = [
    [t("facts.model"), `${vehicle.model.brand} ${vehicle.model.model}`],
    [t("facts.year"), String(vehicle.year)],
    [t("facts.km"), t("facts.kmValue", { km: km.format(vehicle.lastKm) })],
    [t("facts.assignee"), vehicle.status === "RETURNED" ? "—" : (vehicle.assignee?.name ?? t("facts.idle"))],
    [t("facts.maintenance"), due(vehicle.nextMaintenanceOn)],
    [t("facts.inspection"), due(vehicle.inspectionDueOn)],
    ...(vehicle.returnedAt ? ([[t("facts.returnedAt"), dateTime.format(new Date(vehicle.returnedAt))]] as Array<[string, string]>) : []),
  ];

  // The latest requests for this car (V2-41). They are a convenience: if they cannot be loaded the rest of the page still shows.
  const requestsT = await getTranslations("FleetPanel.requests");
  const requests: ServiceRequestPage | null = await getFleetRequests({ page: 1, pageSize: 5, sort: { key: "createdAt", dir: "desc" }, q: "", filters: {} }, vehicle.id).catch(() => null);

  return (
    <>
      <PageHeader
        title={vehicle.plate}
        description={`${vehicle.model.brand} ${vehicle.model.model} · ${vehicle.year}`}
        action={<StatusChip tone={vehicle.status === "ACTIVE" ? "success" : "neutral"}>{t(`status.${vehicle.status}`)}</StatusChip>}
      />
      <Button asChild variant="outline" className="self-start">
        <Link href="/filom/araclar">{t("back")}</Link>
      </Button>

      <section aria-labelledby="vehicle-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="vehicle-facts" className="text-h3 text-fg">
          {t("facts.title")}
        </h2>
        <dl className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-2">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt className="text-small text-fg-muted">{term}</dt>
              <dd className="break-words text-body text-fg">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-small text-fg-muted">{t("facts.contract")}</dt>
            <dd className="break-words text-body">
              <Link href={{ pathname: "/filom/sozlesmeler/[number]", params: { number: vehicle.contract.number } }} className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
                {vehicle.contract.number}
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <VehicleAssignment key={`${vehicle.id}:${open?.id ?? "none"}:${vehicle.status}`} vehicle={vehicle} open={open} employees={employees} />

      <section aria-labelledby="vehicle-history" className="flex max-w-2xl flex-col gap-3 border-t border-border pt-6">
        <h2 id="vehicle-history" className="text-h3 text-fg">
          {t("history.title")}
        </h2>
        {vehicle.assignments.length === 0 ? (
          <p className="rounded-card border border-border p-4 text-body text-fg-muted">{t("history.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {vehicle.assignments.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 rounded-card border border-border p-4">
                <p className="text-label text-fg">{entry.employee.name}</p>
                <p className="text-small text-fg-muted">
                  {entry.endedAt ? t("history.period", { from: dateTime.format(new Date(entry.startedAt)), to: dateTime.format(new Date(entry.endedAt)) }) : t("history.since", { from: dateTime.format(new Date(entry.startedAt)) })}
                  {entry.employee.department ? ` · ${entry.employee.department}` : ""}
                </p>
                {entry.note && <p className="text-small text-fg-muted">{entry.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="vehicle-readings" className="flex max-w-2xl flex-col gap-3">
        <h2 id="vehicle-readings" className="text-h3 text-fg">
          {t("readings.title")}
        </h2>
        {vehicle.readings.length === 0 ? (
          <p className="rounded-card border border-border p-4 text-body text-fg-muted">{t("readings.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {vehicle.readings.map((reading) => (
              <li key={reading.id} className="flex flex-col gap-1 rounded-card border border-border p-3 text-small">
                <span className="text-fg">{`${dateTime.format(new Date(reading.at))} · ${t("facts.kmValue", { km: km.format(reading.km) })}`}</span>
                <span className="text-fg-muted">
                  {[
                    reading.fuelPercent !== null ? t("readings.fuel", { value: reading.fuelPercent }) : null,
                    reading.chargePercent !== null ? t("readings.charge", { value: reading.chargePercent }) : null,
                    reading.batteryHealthPercent !== null ? t("readings.battery", { value: reading.batteryHealthPercent }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {requests && (
        <section aria-labelledby="vehicle-requests" className="flex max-w-2xl flex-col gap-3 border-t border-border pt-6">
          <h2 id="vehicle-requests" className="text-h3 text-fg">
            {requestsT("vehicleSection.title")}
          </h2>
          {requests.items.length === 0 ? (
            <p className="rounded-card border border-border p-4 text-body text-fg-muted">{requestsT("vehicleSection.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {requests.items.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3">
                  <div className="flex flex-col">
                    <Link href={{ pathname: "/filom/talepler/[number]", params: { number: entry.number } }} className="inline-flex min-h-11 items-center text-label text-link underline underline-offset-4">
                      {entry.number}
                    </Link>
                    <span className="text-small text-fg-muted">{requestsT(`type.${entry.type}`)}</span>
                  </div>
                  <StatusChip tone={requestTone(entry.type, entry.status)}>{requestsT(`status.${entry.status}`)}</StatusChip>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={{ pathname: "/filom/talepler/yeni", query: { arac: vehicle.id } }}>{requestsT("vehicleSection.new")}</Link>
            </Button>
            {requests.total > requests.items.length && (
              <Button asChild variant="ghost">
                <Link href="/filom/talepler">{requestsT("vehicleSection.all")}</Link>
              </Button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
