import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
};

type FieldProps = {
  label: string;
  hint?: string;
  // Shown next to the control (BACKLOG #23); also marks the control invalid for screen readers.
  error?: string;
  className?: string;
  // `labelId` is for custom controls (e.g. a button-style picker) that must name
  // themselves with both the label and their current value.
  children: (controlProps: ControlProps, meta: { labelId: string }) => ReactNode;
};

// Wires label, hint and error to the control through ids so every form gets the
// same accessible name and error announcement without repeating the plumbing.
function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label id={labelId} htmlFor={id} className="text-label text-fg">
        {label}
      </label>
      {children(
        { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined },
        { labelId },
      )}
      {hint && (
        <p id={hintId} className="text-small text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-small text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export { Field };
export type { ControlProps };
