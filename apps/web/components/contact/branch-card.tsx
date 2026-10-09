import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { directionsUrl, type BranchDetail, type DayHours } from "@/lib/branch-detail";
import { cn } from "@/lib/cn";

type BranchCardProps = {
  branch: BranchDetail;
  selected: boolean;
  onShowOnMap: () => void;
};

export function BranchCard({ branch, selected, onShowOnMap }: BranchCardProps) {
  const t = useTranslations("ContactPage.card");

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
        selected ? "border-primary" : "border-border",
      )}
    >
      <header>
        <h3 className="text-h3 text-fg">{branch.name}</h3>
        <p className="text-small text-fg-muted">{branch.city}</p>
      </header>

      <p className="flex items-start gap-2 text-body text-fg">
        <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-fg-muted" />
        {branch.address}
      </p>

      <div className="flex items-start gap-2">
        <Clock aria-hidden="true" className="mt-1 size-4 shrink-0 text-fg-muted" />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-body">
          <dt className="sr-only">{t("hours")}</dt>
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
        <a href={`mailto:${branch.email}`} className={link}>
          <Mail aria-hidden="true" className="size-4" />
          {t("email")}
        </a>
        <a href={directionsUrl(branch)} target="_blank" rel="noopener noreferrer" className={link}>
          <Navigation aria-hidden="true" className="size-4" />
          {t("directions")}
          <span className="sr-only"> {t("newTab")}</span>
        </a>
      </div>

      <Button type="button" variant="outline" onClick={onShowOnMap} className="self-start">
        {t("showOnMap")}
        <span className="sr-only">: {branch.name}</span>
      </Button>
    </article>
  );
}
