import { useTranslations } from "next-intl";
import { StatusChip } from "@/components/admin/status-chip";

// "Simülasyon" (ADR-30, docs/FLEET.md §3.1): the answer says `simulated: true`, and every place that shows made-up data wears this.
export function SimulationBadge() {
  const t = useTranslations("FleetPanel.green");
  return <StatusChip tone="neutral">{t("simulation")}</StatusChip>;
}
