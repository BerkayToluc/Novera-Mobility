import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

// The short form of the Road Assurance promise (SPEC §5.5), repeated where a visitor is
// about to decide: car detail, booking summary, payment.
export async function GuaranteeStrip() {
  const t = await getTranslations("GuaranteeStrip");

  return (
    <p className="flex items-start gap-3 rounded-card bg-accent-soft p-4 text-body text-on-accent-soft">
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      {t("text")}
    </p>
  );
}
