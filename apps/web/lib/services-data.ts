import { Headset, KeyRound, Siren, Truck, Wrench, type LucideIcon } from "lucide-react";
import type { ProductSlug } from "./products";

// The five services (SPEC §2.5, v0.9) in the order of the messages' `items`: one icon each, which
// packages carry it, and which products include it. The texts are in messages/<lang>/services.json.
export const SERVICE_ICONS: readonly LucideIcon[] = [Truck, Headset, KeyRound, Wrench, Siren];

export type ServicePlan = "individual" | "corporate" | "vip";

// Who has the service: an individual rental, a corporate fleet, the VIP mobility product.
export const SERVICE_PLANS: readonly (readonly ServicePlan[])[] = [
  ["individual", "corporate", "vip"], // roadside assistance
  ["individual", "corporate", "vip"], // operations desk
  ["corporate", "vip"], // replacement car
  ["corporate", "vip"], // maintenance and tyre hotel
  ["individual", "corporate", "vip"], // SOS
];

// Product by service: true when the product includes it (an example; G corrects it here).
export const PRODUCT_COVERAGE: Record<ProductSlug, readonly boolean[]> = {
  "akilli-kurumsal-filo": [true, true, true, true, true],
  "vip-mobilite": [true, true, true, true, true],
  "esnek-kisa-donem": [true, true, false, false, true],
  "yesil-filo": [true, true, true, true, true],
};
