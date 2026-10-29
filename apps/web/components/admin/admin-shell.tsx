import type { ReactNode } from "react";
import { AdminNav } from "./admin-nav";

// The frame of every panel page (DESIGN.md §8): the menu on the left from xl, on top below it, and the page beside or under
// it. The same language as the profile's frame. `min-w-0` lets a wide table scroll in its own box instead of pushing the
// page sideways.
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-8 md:px-8 xl:grid xl:grid-cols-sidebar xl:gap-12 xl:py-14">
      <AdminNav />
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
    </div>
  );
}
