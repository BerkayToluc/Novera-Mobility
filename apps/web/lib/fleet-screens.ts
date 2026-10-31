import { Car, FileText, KeyRound, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

// The screens of Filom (docs/FLEET.md §3), in the order of the menu. The screens of the later issues (invoices, expenses, requests,
// live tracking, reports, green fleet) are added here when they are built, with their addresses in i18n/routing.ts (a test checks it).
export type FleetScreenKey = "summary" | "vehicles" | "employees" | "assignments" | "contracts";

export type FleetScreen = { key: FleetScreenKey; href: string; icon: LucideIcon };

export const FLEET_SCREENS: readonly FleetScreen[] = [
  { key: "summary", href: "/filom", icon: LayoutDashboard },
  { key: "vehicles", href: "/filom/araclar", icon: Car },
  { key: "employees", href: "/filom/personel", icon: Users },
  { key: "assignments", href: "/filom/zimmet", icon: KeyRound },
  { key: "contracts", href: "/filom/sozlesmeler", icon: FileText },
];

// The summary is the front door, so it is the current screen only on its own address; the others also own what is under them.
export function isCurrentFleetScreen(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/filom" && pathname.startsWith(`${href}/`));
}
