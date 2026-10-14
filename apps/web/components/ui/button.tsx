import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Every size keeps a 44px minimum height (WCAG 2.2 AA target size, see CLAUDE.md).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-label transition-colors disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-on-primary hover:bg-primary-hover disabled:bg-surface-muted disabled:text-fg-subtle",
        outline:
          "border border-border-strong bg-surface text-fg hover:bg-selected disabled:text-fg-subtle",
        ghost: "text-fg hover:bg-selected disabled:text-fg-subtle",
        // Outlined in the error colour rather than filled: white on the dark-theme error colour is too low in contrast.
        destructive:
          "border border-error bg-surface text-error hover:bg-surface-muted disabled:border-border disabled:text-fg-subtle",
        link: "text-link underline-offset-4 hover:underline disabled:text-fg-subtle",
      },
      // The header pill and its controls are fully round; everything else keeps the control radius.
      shape: {
        control: "rounded-control",
        pill: "rounded-full",
      },
      size: {
        default: "min-h-11 px-5",
        // Header controls that sit in a row (currency, language): same height, less padding.
        compact: "min-h-11 px-3",
        // A link-styled button that sits in text flow: no side padding, so it lines up with the content above it.
        inline: "min-h-11 px-0",
        lg: "min-h-12 px-6",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      shape: "control",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    // Renders the child (e.g. a locale-aware Link) with button styling.
    asChild?: boolean;
  };

function Button({ className, variant, size, shape, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, shape }), className)} {...props} />;
}

export { Button, buttonVariants };
