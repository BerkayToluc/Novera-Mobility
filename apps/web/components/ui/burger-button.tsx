import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type BurgerButtonProps = Omit<ComponentProps<"button">, "children"> & {
  // Controlled by the menu it opens, so the icon cannot disagree with it
  // (e.g. when Escape closes the menu).
  open: boolean;
  label: string;
};

// Three lines that turn into an X: the outer lines shrink away and the middle line
// splits into two crossing bars. The geometry follows the Framer "Burger Menu Icon"
// the design was based on, rebuilt with CSS transitions so no animation library is needed.
function BurgerButton({ open, label, className, ...props }: BurgerButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={label}
      className={cn(
        "group inline-flex size-11 items-center justify-center rounded-control text-fg hover:bg-selected",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="flex w-6 flex-col items-center gap-1">
        <span className="h-0.5 w-full bg-current transition-[width] duration-200 ease-out group-aria-expanded:w-0" />
        <span className="relative h-0.5 w-full">
          <span className="absolute inset-0 bg-current transition-transform duration-200 ease-out group-aria-expanded:rotate-45" />
          <span className="absolute inset-0 bg-current transition-transform duration-200 ease-out group-aria-expanded:-rotate-45" />
        </span>
        <span className="h-0.5 w-full bg-current transition-[width] duration-200 ease-out group-aria-expanded:w-0" />
      </span>
    </button>
  );
}

export { BurgerButton };
