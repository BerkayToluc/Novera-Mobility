import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

// A product card on a soft tonal wash (SPEC §2.5, after the "gradient-card" component): a badge
// with a coloured dot, the title and a line of text, an arrow link at the foot, and the product's
// drawing tucked into the bottom-right corner. Pointed at or focused, the card rises a little and
// the drawing grows and turns; with reduced motion only the shadow changes. The washes are built
// from the theme's own tokens, so they follow dark mode (SPEC §5.6 allows a gradient here and
// nowhere else, G's decision). The whole card is one link through its title (stretched ::after).
const cardVariants = cva(
  "group/gc relative isolate flex h-full flex-col overflow-hidden rounded-card border border-border p-6 transition-[translate,scale,box-shadow] duration-300 ease-spring focus-within:-translate-y-1 focus-within:scale-[1.02] focus-within:shadow-float hover:-translate-y-1 hover:scale-[1.02] hover:shadow-float motion-reduce:transform-none motion-reduce:transition-shadow md:p-8",
  {
    variants: {
      tone: {
        olive: "bg-linear-to-br from-selected to-surface",
        aegean: "bg-linear-to-br from-accent-soft to-surface",
        stone: "bg-linear-to-br from-surface-muted to-surface",
        leaf: "bg-linear-to-br from-selected via-surface to-accent-soft",
      },
      size: {
        default: "min-h-72",
        large: "min-h-80 md:min-h-96",
      },
    },
    defaultVariants: { tone: "stone", size: "default" },
  },
);

type GradientCardProps = VariantProps<typeof cardVariants> & {
  href: ComponentProps<typeof Link>["href"];
  badge: string;
  // The dot beside the badge: the primary colour, or the accent for the featured product.
  badgeDot?: "primary" | "accent";
  title: string;
  description: string;
  cta: string;
  art: ReactNode;
  headingAs?: "h2" | "h3";
  className?: string;
};

export function GradientCard({
  href,
  badge,
  badgeDot = "primary",
  title,
  description,
  cta,
  art,
  tone,
  size,
  headingAs: Heading = "h2",
  className,
}: GradientCardProps) {
  return (
    <article className={cn(cardVariants({ tone, size }), className)}>
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute -z-10 transition-[scale,rotate] duration-500 ease-spring group-focus-within/gc:rotate-3 group-focus-within/gc:scale-110 group-hover/gc:rotate-3 group-hover/gc:scale-110 motion-reduce:transition-none", size === "large" ? "-bottom-6 -right-6 w-48 md:w-64" : "-bottom-4 -right-4 w-28 md:w-32")}
      >
        {art}
      </div>

      <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-surface/70 px-3 py-1 text-small text-fg backdrop-blur-sm">
        <span aria-hidden="true" className={cn("size-2 rounded-full", badgeDot === "accent" ? "bg-accent" : "bg-primary")} />
        {badge}
      </span>

      <div className="flex max-w-sm flex-1 flex-col gap-2">
        <Heading className={cn("text-fg", size === "large" ? "text-h2" : "text-h3")}>
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {title}
          </Link>
        </Heading>
        <p className="text-body text-fg-muted">{description}</p>
      </div>

      {/* The card's focus ring: the link inside takes focus, the card shows it. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-card group-has-[a:focus-visible]/gc:outline-2 group-has-[a:focus-visible]/gc:-outline-offset-2 group-has-[a:focus-visible]/gc:outline-focus" />

      <p aria-hidden="true" className="mt-6 inline-flex items-center gap-2 text-label text-fg">
        {cta}
        <ArrowRight className="size-4 transition-transform duration-300 group-focus-within/gc:translate-x-1 group-hover/gc:translate-x-1 motion-reduce:transition-none" />
      </p>
    </article>
  );
}
