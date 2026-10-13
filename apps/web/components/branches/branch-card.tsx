"use client";

import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ContactLink } from "@/components/ui/contact-link";
import { Link } from "@/i18n/navigation";
import { directionsUrl, type BranchDetail, type DayHours } from "@/lib/branch-detail";
import { cn } from "@/lib/cn";
import { useOpeningLabel } from "@/lib/use-opening-label";

type BranchCardProps = {
  branch: BranchDetail;
  selected: boolean;
  onShowOnMap: () => void;
  // The time the status is read at; null until the page is in the browser, so the server's
  // clock and the browser's never disagree on the page.
  now: Date | null;
  // How far the visitor is, in whole kilometres, once they have shared their position.
  distanceKm?: number;
};

export function BranchCard({ branch, selected, onShowOnMap, now, distanceKm }: BranchCardProps) {
  const t = useTranslations("BranchesPage.card");
  const label = useOpeningLabel();
  const status = now ? label(branch.openingHours, now) : null;

  const hours = (value: DayHours) => {
    if (!value) return t("closed");
    if (value.open === "00:00" && value.close === "24:00") return t("allDay");
    return t("range", { open: value.open, close: value.close });
  };
  const rows = [
    { label: t("weekdays"), value: hours(branch.openingHours.weekdays) },
    { label: t("saturday"), value: hours(branch.openingHours.saturday) },
    { label: t("sunday"), value: hours(branch.openingHours.sunday) },
  ];
  const link = "inline-flex min-h-11 items-center gap-2 text-link underline underline-offset-4";

  return (
    <article
      aria-current={selected || undefined}
      className={cn(
        "flex flex-col gap-4 rounded-card border bg-surface p-5",
        selected ? "border-focus" : "border-border",
      )}
    >
      <header className="flex flex-col gap-2">
        <div>
          <h3 className="text-h3 text-fg">{branch.name}</h3>
          <p className="text-small text-fg-muted">
            {branch.city}
            {distanceKm !== undefined && <span className="tabular-nums"> · {t("distance", { km: distanceKm })}</span>}
          </p>
        </div>
        {/* Open or closed right now (the dot is only for the eye: the words say it). */}
        {status && (
          <p className="flex items-center gap-2 text-small text-fg">
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", status.open ? "bg-success" : "bg-fg-subtle")} />
            {status.text}
          </p>
        )}
      </header>

      <p className="flex items-start gap-2 text-body text-fg">
        <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-fg-muted" />
        {branch.address}
      </p>

      <div className="flex items-start gap-2">
        <Clock aria-hidden="true" className="mt-1 size-4 shrink-0 text-fg-muted" />
        <p className="sr-only">{t("hours")}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-body">
          {rows.map((row) => (
            <div key={row.label} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-fg-muted">{row.label}</dt>
              <dd className="tabular-nums text-fg">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col items-start">
        <a href={`tel:${branch.phone.replace(/\s/g, "")}`} className={link}>
          <Phone aria-hidden="true" className="size-4" />
          {t("call", { phone: branch.phone })}
        </a>
        <ContactLink value={branch.email} label={t("email")} className="gap-2 text-link underline underline-offset-4" />
        <a href={directionsUrl(branch)} target="_blank" rel="noopener noreferrer" className={link}>
          <Navigation aria-hidden="true" className="size-4" />
          {t("directions")}
          <span className="sr-only"> {t("newTab")}</span>
        </a>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={{ pathname: "/", query: { alis: branch.id }, hash: "kiralama" }}>
            {t("rentHere")}
            <span className="sr-only"> {branch.name}</span>
          </Link>
        </Button>
        <Button type="button" variant="outline" onClick={onShowOnMap}>
          {t("showOnMap")}
          <span className="sr-only"> {branch.name}</span>
        </Button>
      </div>
    </article>
  );
}
