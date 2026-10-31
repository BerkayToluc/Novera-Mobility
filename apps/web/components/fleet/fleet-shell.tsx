import type { ReactNode } from "react";
import { ToastProvider } from "@/components/admin/toast";
import { FleetNav } from "./fleet-nav";

// The frame of every Filom page (DESIGN.md §8): the menu on the left from xl, on top below it, and the page beside or under it, the same
// language as the administration's frame. `min-w-0` lets a wide table scroll in its own box instead of pushing the page sideways. The
// notices (toasts) live here, in the frame that stays while the pages change.
export function FleetShell({ company, children }: { company: string; children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8 md:px-8 xl:grid xl:grid-cols-sidebar xl:gap-12 xl:py-14">
        <div className="flex flex-col gap-4 print:hidden">
          <p className="text-label text-fg-muted">{company}</p>
          <FleetNav />
        </div>
        <div className="flex min-w-0 flex-col gap-8">{children}</div>
      </div>
    </ToastProvider>
  );
}
