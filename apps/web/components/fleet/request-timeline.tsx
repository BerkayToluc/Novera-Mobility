import { getFormatter, getTranslations } from "next-intl/server";
import { StatusChip } from "@/components/admin/status-chip";
import { requestTone, type RequestEvent, type RequestType } from "@/lib/requests";

// The timeline of a request (V2-41, docs/FLEET.md §3): every step with its time and its note, oldest first, and whether the company or Novera
// did it. No names: either side only needs to know which of the two it was. The last line is where the request is now.
export async function RequestTimeline({ type, events }: { type: RequestType; events: readonly RequestEvent[] }) {
  const t = await getTranslations("FleetPanel.requests");
  const format = await getFormatter();
  return (
    <ol aria-label={t("timeline.label")} className="flex flex-col gap-0">
      {events.map((event, index) => {
        const last = index === events.length - 1;
        return (
          <li key={`${event.status}-${event.at}`} className="flex gap-4">
            <div className="flex flex-col items-center" aria-hidden="true">
              <span className={last ? "mt-2 size-3 shrink-0 rounded-full bg-primary" : "mt-2 size-3 shrink-0 rounded-full border-2 border-border-strong bg-surface"} />
              {!last && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="flex min-w-0 flex-col gap-1 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={requestTone(type, event.status)}>{t(`status.${event.status}`)}</StatusChip>
                <span className="text-small text-fg-muted">{event.by === "COMPANY" ? t("timeline.company") : t("timeline.novera")}</span>
              </div>
              <time dateTime={event.at} className="text-small text-fg-muted">
                {format.dateTime(new Date(event.at), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" })}
              </time>
              {event.note && <p className="break-words text-body text-fg">{event.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
