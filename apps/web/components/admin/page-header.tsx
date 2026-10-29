import type { ReactNode } from "react";

// The head of every panel page (DESIGN.md §8): the title, and at most one primary button ("Yeni bayi") on the right.
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-h1 text-fg">{title}</h1>
        {description && <p className="max-w-prose text-body text-fg-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
