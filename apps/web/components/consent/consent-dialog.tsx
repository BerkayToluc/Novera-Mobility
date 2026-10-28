"use client";

import { forwardRef, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// The cookie settings window (ADR-19): a native modal <dialog>, so the browser traps focus,
// closes it on Escape and returns focus to whatever opened it. Necessary cookies are shown as
// always on; analytics is the one switch.
export const ConsentDialog = forwardRef<
  HTMLDialogElement,
  { analytics: boolean; onSave: (analytics: boolean) => void }
>(function ConsentDialog({ analytics, onSave }, ref) {
  const t = useTranslations("Consent.dialog");
  const titleId = useId();
  // The form is remounted every time the window closes, so what was ticked and then cancelled
  // is forgotten and the next visit starts from the choice in force.
  const [round, setRound] = useState(0);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => setRound((current) => current + 1)}
      className="m-auto w-dialog max-w-lg rounded-card border border-border bg-surface p-0 text-fg backdrop:bg-fg/40"
    >
      <ConsentForm key={`${analytics}-${round}`} analytics={analytics} onSave={onSave} titleId={titleId} t={t} />
    </dialog>
  );
});

type Translate = ReturnType<typeof useTranslations>;

function ConsentForm({
  analytics,
  onSave,
  titleId,
  t,
}: {
  analytics: boolean;
  onSave: (analytics: boolean) => void;
  titleId: string;
  t: Translate;
}) {
  const [draft, setDraft] = useState(analytics);

  return (
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
        className="flex flex-col gap-6 p-6 md:p-8"
      >
        <header className="flex flex-col gap-2">
          <h2 id={titleId} className="text-h2 text-fg">
            {t("title")}
          </h2>
          <p className="text-body text-fg-muted">
            {t("text")}{" "}
            <Link href="/cerez-politikasi" className="text-link underline underline-offset-4">
              {t("policy")}
            </Link>
          </p>
        </header>

        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">{t("legend")}</legend>
          <label className="flex min-h-11 items-start gap-3 rounded-card border border-border bg-surface-muted p-4">
            <input type="checkbox" checked disabled className="mt-0.5 size-5 shrink-0" />
            <span className="flex flex-col gap-1">
              <span className="text-label text-fg">{t("necessary.title")}</span>
              <span className="text-small text-fg-muted">{t("necessary.text")}</span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-border p-4">
            <input
              type="checkbox"
              checked={draft}
              onChange={(event) => setDraft(event.target.checked)}
              className="mt-0.5 size-5 shrink-0"
            />
            <span className="flex flex-col gap-1">
              <span className="text-label text-fg">{t("analytics.title")}</span>
              <span className="text-small text-fg-muted">{t("analytics.text")}</span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg">
            {t("save")}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={(event) => event.currentTarget.form?.closest("dialog")?.close()}>
            {t("cancel")}
          </Button>
        </div>
      </form>
  );
}
