import type { ReactNode } from "react";
import { ClientMessages } from "@/components/client-messages";

// The text the client components of this section use (V2-15; the list is i18n/client-messages.ts).
export default function SectionMessages({ children }: { children: ReactNode }) {
  return <ClientMessages route="sifre-sifirla/layout">{children}</ClientMessages>;
}
