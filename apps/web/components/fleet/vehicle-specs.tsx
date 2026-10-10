"use client";

import { Cog, Fuel, Gauge, Luggage, Users, Zap, type LucideIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { FleetModel } from "@/lib/fleet-models";

export type Spec = { key: string; icon: LucideIcon; label: string };

// The short facts of a model (SPEC §2.4), in the order a renter weighs them: what it burns,
// what it runs on, how it shifts, then room. Shared by the card and the dialog.
export function useSpecs(model: FleetModel): Spec[] {
  const t = useTranslations("Vehicle");
  const format = useFormatter();
  const electric = model.fuelType === "ELECTRIC";
  const value = format.number(model.consumption.value, { maximumFractionDigits: 1 });

  return [
    { key: "consumption", icon: Gauge, label: t(`consumption.${model.consumption.unit}`, { value }) },
    { key: "fuel", icon: electric ? Zap : Fuel, label: t(`fuel.${model.fuelType}`) },
    { key: "transmission", icon: Cog, label: t(`transmission.${model.transmission}`) },
    { key: "seats", icon: Users, label: t("seats", { count: model.seats }) },
    { key: "bags", icon: Luggage, label: t("bags", { count: model.bags }) },
  ];
}
