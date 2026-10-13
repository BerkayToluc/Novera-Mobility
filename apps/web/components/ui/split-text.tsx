import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

// The hover of the Framer "SplitTextHover" component: when the parent is pointed at or focused,
// each letter rolls up out of view while a second copy rolls up from below, one letter after
// another (0.3 s each, 20 ms apart). Pure CSS, so it works in server components and costs no
// script: the parent carries `splitTextGroup`, the letters read it through group-hover and
// group-focus-visible. Screen readers get the word once (sr-only); both letter rows are hidden
// from them. With reduced motion nothing moves.
export const splitTextGroup = "group/st";

const letter =
  "inline-block whitespace-pre transition-transform duration-300 ease-split [transition-delay:calc(var(--i)*20ms)] motion-reduce:transition-none";

export function SplitText({ text, className }: { text: string; className?: string }) {
  const letters = [...text];
  const delay = (index: number) => ({ "--i": index }) as CSSProperties;

  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {letters.map((char, index) => (
          <span
            key={index}
            style={delay(index)}
            className={cn(letter, "motion-safe:group-hover/st:-translate-y-full motion-safe:group-focus-visible/st:-translate-y-full")}
          >
            {char}
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="absolute inset-0 inline-flex motion-reduce:hidden">
        {letters.map((char, index) => (
          <span
            key={index}
            style={delay(index)}
            className={cn(letter, "translate-y-full group-hover/st:translate-y-0 group-focus-visible/st:translate-y-0")}
          >
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
