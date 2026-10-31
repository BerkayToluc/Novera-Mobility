import { getFormatter, getTranslations } from "next-intl/server";
import type { ServiceRequestDetail } from "@/lib/requests";

type Details = Record<string, unknown>;

// What a request is about, as a list of terms and values (V2-41): the car, then the fields of its kind. The same for the customer and the
// administrator; the words are those of the customer's screens.
export async function RequestFacts({ request, className }: { request: Pick<ServiceRequestDetail, "type" | "details" | "vehicle" | "createdAt">; className?: string }) {
  const t = await getTranslations("FleetPanel.requests");
  const format = await getFormatter();
  const details = request.details as Details;
  const day = (value: unknown) => (typeof value === "string" ? format.dateTime(new Date(`${value}T12:00:00Z`), { dateStyle: "long", timeZone: "UTC" }) : t("facts.none"));
  const str = (value: unknown) => (typeof value === "string" && value !== "" ? value : t("facts.none"));
  const rows: Array<[string, string]> = [];
  if (request.vehicle) rows.push([t("detail.vehicle"), `${request.vehicle.plate} · ${request.vehicle.model}`]);

  if (request.type === "ROADSIDE") {
    const location = (details.location ?? {}) as { address?: string | null; latitude?: number | null; longitude?: number | null };
    rows.push([t("facts.incident"), t(`incidents.${details.incident as "BREAKDOWN"}`)]);
    rows.push([t("facts.location"), [location.address, location.latitude != null && location.longitude != null ? t("facts.position", { latitude: location.latitude, longitude: location.longitude }) : null].filter(Boolean).join(" · ") || t("facts.none")]);
    rows.push([t("facts.description"), str(details.description)]);
  } else if (request.type === "REPLACEMENT_VEHICLE") {
    rows.push([t("facts.deliveryAddress"), str(details.address)]);
    rows.push([t("facts.deliveryDate"), day(details.date)]);
    rows.push([t("facts.duration"), t("facts.durationValue", { count: Number(details.durationDays) })]);
  } else if (request.type === "TRANSFER") {
    const meeting = (details.meeting ?? {}) as { airport?: string | null; address?: string | null };
    rows.push([t("facts.passenger"), `${str(details.passengerName)} · ${t("facts.passengerCount", { count: Number(details.passengers) })}`]);
    rows.push([t("facts.flight"), details.flightNumber ? `${String(details.flightNumber)} · ${t("facts.flightNote")}` : t("facts.none")]);
    rows.push([t("facts.meetingPlace"), meeting.airport ? t(`airports.${meeting.airport as "IST"}`) : str(meeting.address)]);
    rows.push([t("facts.meetingAt"), typeof details.meetingAt === "string" ? format.dateTime(new Date(details.meetingAt), { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }) : t("facts.none")]);
    rows.push([t("facts.destination"), str(details.destination)]);
    if (details.note) rows.push([t("facts.note"), str(details.note)]);
  } else if (request.type === "MAINTENANCE") {
    rows.push([t("facts.service"), t(`services.${details.service as "PERIODIC"}`)]);
    rows.push([t("facts.preferredDate"), day(details.preferredDate)]);
    rows.push([t("facts.valet"), details.valet ? t("facts.valetYes") : t("facts.valetNo")]);
    if (details.address) rows.push([t("facts.pickupAddress"), str(details.address)]);
  }
  rows.push([t("detail.opened"), format.dateTime(new Date(request.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" })]);

  return (
    <dl className={className ?? "grid gap-3 rounded-card border border-border p-4 md:grid-cols-2"}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="text-small text-fg-muted">{term}</dt>
          <dd className="break-words text-body text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
