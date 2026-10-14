import type { CSSProperties } from "react";

// The footer's link hover (SPEC §2.8, after the Framer "Wavy Nav link"): pointed at or focused,
// the letters drop a few pixels and spring back one after another, a wave running along the word,
// while a thin line grows under it from the left. Leaving, the line goes at once. Pure CSS: the
// link carries `group/fl`, each letter its index (--i) for the wave's delay. The word is read once
// (sr-only); the letters are hidden from screen readers. With reduced motion only the line shows.
export const footerLinkClasses =
  "group/fl relative inline-flex min-h-11 min-w-11 items-center text-body text-fg-muted transition-colors duration-200 hover:text-fg focus-visible:text-fg";

export function WavyText({ text }: { text: string }) {
  return (
    <span className="relative inline-flex">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex">
        {[...text].map((char, index) => (
          <span
            key={index}
            style={{ "--i": index } as CSSProperties}
            className="inline-block whitespace-pre [animation-delay:calc(var(--i)*20ms)] motion-safe:group-hover/fl:animate-wave motion-safe:group-focus-visible/fl:animate-wave"
          >
            {char}
          </span>
        ))}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 rounded-full bg-current group-hover/fl:scale-x-100 group-hover/fl:transition-[scale] group-hover/fl:duration-400 group-hover/fl:ease-menu group-focus-visible/fl:scale-x-100"
      />
    </span>
  );
}
