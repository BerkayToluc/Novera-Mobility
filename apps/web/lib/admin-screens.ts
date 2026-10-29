import {
  Building2,
  CalendarRange,
  Car,
  CarFront,
  FileText,
  History,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Receipt,
  Ticket,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// The screens of the panel (docs/ADMIN.md §3), in the order of the menu. A screen whose `ready` is false is not in the
// menu: it is listed here so its name, icon and place are settled once, and the issue that builds it only turns it on
// (and adds its address to i18n/routing.ts, which a test checks).
export type AdminScreenKey =
  | "summary"
  | "promoCodes"
  | "branches"
  | "models"
  | "vehicles"
  | "extras"
  | "reservations"
  | "quotes"
  | "messages"
  | "companies"
  | "invoices"
  | "fleetExpenses"
  | "requests"
  | "users"
  | "auditLog";

export type AdminScreen = { key: AdminScreenKey; href: string; icon: LucideIcon; ready: boolean };

export const ADMIN_SCREENS: readonly AdminScreen[] = [
  { key: "summary", href: "/yonetim", icon: LayoutDashboard, ready: true },
  { key: "promoCodes", href: "/yonetim/kampanya-kodlari", icon: Ticket, ready: false },
  { key: "branches", href: "/yonetim/bayiler", icon: Building2, ready: false },
  { key: "models", href: "/yonetim/modeller", icon: CarFront, ready: false },
  { key: "vehicles", href: "/yonetim/araclar", icon: Car, ready: false },
  { key: "extras", href: "/yonetim/ek-hizmetler", icon: Wrench, ready: false },
  { key: "reservations", href: "/yonetim/rezervasyonlar", icon: CalendarRange, ready: false },
  { key: "quotes", href: "/yonetim/teklifler", icon: FileText, ready: false },
  { key: "messages", href: "/yonetim/mesajlar", icon: MessageSquare, ready: false },
  { key: "companies", href: "/yonetim/sirketler", icon: Building2, ready: false },
  { key: "invoices", href: "/yonetim/faturalar", icon: Receipt, ready: false },
  { key: "fleetExpenses", href: "/yonetim/filo-masraflari", icon: Wallet, ready: false },
  { key: "requests", href: "/yonetim/talepler", icon: LifeBuoy, ready: false },
  { key: "users", href: "/yonetim/kullanicilar", icon: Users, ready: false },
  { key: "auditLog", href: "/yonetim/kayit", icon: History, ready: false },
];

export const readyScreens = (): AdminScreen[] => ADMIN_SCREENS.filter((screen) => screen.ready);

// The summary is the front door, so it is the current screen only on its own address; the others also own what is under them.
export function isCurrentScreen(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/yonetim" && pathname.startsWith(`${href}/`));
}
