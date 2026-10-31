import { Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ContactLink } from "@/components/ui/contact-link";
import { COMPANY } from "@/lib/company";

// On every request screen (V2-41, docs/FLEET.md §3, SPEC §3.D): the 24/7 operations desk and the emergency number. The desk is not a feature
// of its own, it is this telephone: pressed, the number offers "Call" and "Copy" (the same bubble as everywhere else on the site). When a life
// is in danger the answer is 112, not a form.
export async function RequestHelp() {
  const t = await getTranslations("FleetPanel.requests.help");
  return (
    <aside aria-labelledby="request-help" className="flex flex-col gap-2 rounded-card border border-border bg-surface-muted p-4">
      <h2 id="request-help" className="flex items-center gap-2 text-label text-fg">
        <Phone aria-hidden="true" className="size-4 shrink-0 text-link" />
        {t("title")}
      </h2>
      <p className="text-body text-fg-muted">
        {t("desk")}{" "}
        <ContactLink value={COMPANY.phone} className="tabular-nums text-link underline underline-offset-4" />
      </p>
      <p className="text-body text-fg">{t("emergency")}</p>
    </aside>
  );
}
