"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const Context = createContext<{ show: (message: string, tone?: Tone) => void } | null>(null);

export function useToast() {
  const value = useContext(Context);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

// A success goes away by itself after a while; an error stays until it is dismissed, because a message that vanishes
// before it is read is the one that mattered (WCAG 2.2.1, timing).
const SUCCESS_MS = 8000;

// The notices of the panel (ADMIN.md §3.4). Two live regions that are in the page from the start, one polite for what
// went well and one assertive for what did not: a screen reader only announces what is added to a region it already
// knows. Every notice has a button to dismiss it.
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Admin.toast");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = next.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      if (tone === "success") timers.current.set(id, setTimeout(() => dismiss(id), SUCCESS_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  const list = (tone: Tone) =>
    toasts
      .filter((toast) => toast.tone === tone)
      .map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-2 rounded-card border bg-surface p-3 pl-4 text-body text-fg shadow-float",
            tone === "error" ? "border-error" : "border-success",
          )}
        >
          <p className="min-w-0 flex-1 py-2.5">{toast.message}</p>
          <Button type="button" variant="ghost" size="icon" aria-label={t("close")} onClick={() => dismiss(toast.id)}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ));

  return (
    <Context.Provider value={value}>
      {children}
      <section aria-label={t("region")} className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 md:left-auto md:w-96">
        <div role="status" aria-live="polite" className="pointer-events-auto flex flex-col gap-2">
          {list("success")}
        </div>
        <div role="alert" className="pointer-events-auto flex flex-col gap-2">
          {list("error")}
        </div>
      </section>
    </Context.Provider>
  );
}
