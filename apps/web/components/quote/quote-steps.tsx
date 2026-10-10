import { FileText, PhoneCall, Send } from "lucide-react";
import { useTranslations } from "next-intl";

const STEPS = [
  { key: "send", icon: Send },
  { key: "call", icon: PhoneCall },
  { key: "offer", icon: FileText },
] as const;

// What happens after a corporate request (SPEC §2.2.3): shown before the form, so a company
// knows it is starting a conversation with a person, not placing a booking.
export function QuoteSteps() {
  const t = useTranslations("QuoteSteps");

  return (
    <section aria-labelledby="quote-steps-title" className="flex flex-col gap-3">
      <h2 id="quote-steps-title" className="text-label text-fg-muted">
        {t("title")}
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-center gap-3 rounded-control bg-surface-muted p-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-link">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="text-small text-fg">{t(`steps.${key}`)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
