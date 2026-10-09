import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  // Links to the neighbouring auth pages ("No account yet? Sign up").
  footer?: ReactNode;
};

// One narrow column for every auth page: forms read best when short and focused.
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 md:py-16">
      <div className="flex flex-col gap-8 rounded-card border border-border bg-surface p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-h2 text-fg">{title}</h1>
          {subtitle && <p className="text-body text-fg-muted">{subtitle}</p>}
        </header>
        {children}
      </div>
      {footer && <div className="mt-6 flex flex-col items-center gap-1 text-body text-fg-muted">{footer}</div>}
    </div>
  );
}
