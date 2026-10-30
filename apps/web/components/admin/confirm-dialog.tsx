"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  text: string;
  // The name of the action, on the button ("Close the branch"), never a bare "Yes" or "OK" (DESIGN.md §8).
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "destructive" | "primary";
  // The action is running: the button says so and cannot be pressed twice.
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  // A field the person fills in before confirming (the reason of a cancellation), shown under the text.
  children?: ReactNode;
};

// The window that asks before something that cannot be undone (ADMIN.md §3.4). A native modal <dialog>, so the browser
// traps the focus, and Escape asks to close it. Focus starts on "Cancel", the safe answer: Enter on the open window does
// nothing harmful. The browser gives focus back to what opened it.
export function ConfirmDialog({ open, title, text, confirmLabel, cancelLabel, tone = "destructive", pending = false, onConfirm, onCancel, children }: Props) {
  const t = useTranslations("Admin.confirm");
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={textId}
      // Escape arrives here first; the parent decides (it is the one that holds `open`), and nothing closes while it works.
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-dialog max-w-lg rounded-card border border-border bg-surface p-0 text-fg shadow-overlay backdrop:bg-fg/40"
    >
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-h2 text-fg">
            {title}
          </h2>
          <p id={textId} className="text-body text-fg-muted">
            {text}
          </p>
        </div>
        {children}
        <div className="flex flex-wrap justify-end gap-3">
          <Button ref={cancelRef} type="button" variant="outline" disabled={pending} onClick={onCancel}>
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button type="button" variant={tone === "destructive" ? "destructive" : "primary"} disabled={pending} aria-busy={pending || undefined} onClick={onConfirm}>
            {pending ? t("working") : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
