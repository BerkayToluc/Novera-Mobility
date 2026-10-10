"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { MapPin, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { VehicleImage } from "@/components/vehicle/vehicle-image";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { FleetModel } from "@/lib/fleet-models";
import { formatMoney } from "@/lib/price";
import { useSpecs } from "./vehicle-specs";

// The model dialog (SPEC §2.4, ARCHITECTURE ADR-22): a native <dialog> opened with showModal(),
// so focus stays inside, Escape closes it and the page behind is inert. Whether it is open is
// decided by the parent (`model`); the dialog only mirrors that and reports when the browser
// closed it on its own (Escape, the backdrop, the close button).
export function FleetDialog({
  model,
  className,
  onClose,
}: {
  model: FleetModel | null;
  className?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (model && !dialog.open) dialog.showModal();
    if (!model && dialog.open) dialog.close();
  }, [model]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dialog box itself, not on its content, lands on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={className}
    >
      {model && <DialogContent model={model} titleId={titleId} onClose={() => ref.current?.close()} />}
    </dialog>
  );
}

function DialogContent({ model, titleId, onClose }: { model: FleetModel; titleId: string; onClose: () => void }) {
  const t = useTranslations("FleetPage.dialog");
  const v = useTranslations("Vehicle");
  const format = useFormatter();
  const specs = useSpecs(model);

  return (
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-border p-4 md:px-6">
        <div>
          <h2 id={titleId} className="text-h2 text-fg">
            {model.brand} {model.model}
          </h2>
          <p className="text-small text-fg-muted">{model.year}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("close")} autoFocus>
          <X aria-hidden="true" className="size-5" />
        </Button>
      </header>

      <div className="flex flex-col gap-6 overflow-y-auto p-4 md:p-6">
        <VehicleImage imageUrl={model.imageUrl} brand={model.brand} model={model.model} className="max-h-44 md:max-h-56" />
        <p className="max-w-prose text-body text-fg-muted">{model.description}</p>

        <Section title={t("features")}>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {specs.map(({ key, icon: Icon, label }) => (
              <li key={key} className="flex items-center gap-2 rounded-control bg-surface-muted px-3 py-2 text-small text-fg">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-link" />
                {label}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("branches", { count: model.branches.length })}>
          <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
            {model.branches.map((branch) => (
              <li key={branch.id} className="flex items-center gap-3 px-3 py-2.5">
                <MapPin aria-hidden="true" className="size-4 shrink-0 text-link" />
                <span className="text-body text-fg">{branch.name}</span>
                <span className="ml-auto text-small text-fg-muted">{branch.city}</span>
              </li>
            ))}
          </ul>
          <Link href="/iletisim" className="inline-flex min-h-11 items-center text-label text-link underline-offset-4 hover:underline">
            {t("branchesLink")}
          </Link>
        </Section>
      </div>

      <footer className="flex flex-col gap-3 border-t border-border p-4 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-h3 tabular-nums text-fg">{v("fromPerDay", { price: formatMoney(format, model.fromPrice) })}</p>
        <Button asChild>
          <Link href={{ pathname: "/", hash: "kiralama" }}>{t("rent")}</Link>
        </Button>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-label text-fg">{title}</h3>
      {children}
    </section>
  );
}
