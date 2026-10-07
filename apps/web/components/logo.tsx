import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoProps = {
  // "on-band" is always the white logo, for the dark footer.
  tone?: "auto" | "on-band";
  className?: string;
};

// Decorative (`alt=""`): the link that wraps it carries the accessible name.
// `unoptimized`: SVGs need no resizing, and it keeps the plain <img> the logo always was.
const SIZE = { width: 240, height: 66, unoptimized: true } as const;

export function Logo({ tone = "auto", className }: LogoProps) {
  if (tone === "on-band") {
    return <Image src="/brand/novera-logo-white.svg" alt="" className={className} {...SIZE} />;
  }

  // The green logo disappears on a dark canvas, so the effective dark theme
  // (forced or system, see globals.css) swaps in the white one.
  return (
    <>
      <Image src="/brand/novera-logo.svg" alt="" className={cn("dark:hidden", className)} {...SIZE} />
      <Image
        src="/brand/novera-logo-white.svg"
        alt=""
        className={cn("hidden dark:block", className)}
        {...SIZE}
      />
    </>
  );
}
