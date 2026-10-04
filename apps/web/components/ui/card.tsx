import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Depth comes from the surface/canvas tone difference, not a shadow (SPEC §5.3).
function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface text-fg", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-6", className)} {...props} />;
}

type CardTitleProps = ComponentProps<"h3"> & {
  // The right level depends on where the card sits in the page outline.
  as?: "h2" | "h3" | "h4";
};

function CardTitle({ as: Heading = "h3", className, ...props }: CardTitleProps) {
  return <Heading className={cn("text-h3 text-fg", className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-small text-fg-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3 p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
