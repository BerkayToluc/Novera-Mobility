import type { ComponentProps } from "react";
import type { Link } from "@/i18n/navigation";

// A link target of the site's typed router.
export type Href = ComponentProps<typeof Link>["href"];

// The pages of the panel a list can live on (they are in i18n/routing.ts). A screen adds its address here when it arrives.
export type AdminPath = "/yonetim" | "/yonetim/kampanya-kodlari" | "/yonetim/bayiler" | "/yonetim/modeller" | "/yonetim/araclar" | "/yonetim/ek-hizmetler" | "/yonetim/rezervasyonlar" | "/yonetim/teklifler" | "/yonetim/mesajlar" | "/yonetim/sirketler" | "/dev/admin";
