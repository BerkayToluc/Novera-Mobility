"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "./input";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  showLabel: string;
  hideLabel: string;
};

// On a phone, typing a password blind is the main cause of failed sign-ups, so the
// visitor can reveal it. The toggle is a real button with its state exposed.
export function PasswordInput({ showLabel, hideLabel, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-12", className)} {...props} />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? hideLabel : showLabel}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-control text-fg-muted hover:text-fg"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}
