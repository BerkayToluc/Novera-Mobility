import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";

type FormSuccessProps = {
  title: string;
  text: ReactNode;
  // E.g. the request's reference number, shown so the visitor can quote it when called.
  detail?: ReactNode;
  children?: ReactNode;
};

// What a form turns into once it has been sent (ARCHITECTURE ADR-20). role="status" lets a
// screen reader announce it without moving focus away from where the visitor is.
export function FormSuccess({ title, text, detail, children }: FormSuccessProps) {
  return (
    <div role="status" className="flex flex-col items-start gap-4">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-selected text-on-selected">
        <CircleCheck aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-h3 text-fg">{title}</h2>
      <p className="max-w-prose text-body text-fg-muted">{text}</p>
      {detail}
      {children}
    </div>
  );
}
