import { ArrowUpRight } from "lucide-react";

// The Framer footer's link: a small arrow that is not there until the link is pointed at or
// focused, then fades and grows into the space reserved for it, so the text never moves. The link
// carries `group/fl`; the transition is 0.6 s with the footer's soft easing.
export const footerLinkClasses =
  "group/fl inline-flex min-h-11 min-w-11 items-center gap-0.5 text-body text-fg-muted transition-colors duration-300 hover:text-fg focus-visible:text-fg";

export function FooterArrow() {
  return (
    <span aria-hidden="true" className="relative inline-block size-3 shrink-0">
      <ArrowUpRight className="absolute bottom-0.5 left-0 size-3 scale-90 opacity-0 transition-[opacity,scale] duration-600 ease-link group-hover/fl:scale-100 group-hover/fl:opacity-100 group-focus-visible/fl:scale-100 group-focus-visible/fl:opacity-100 motion-reduce:transition-none" />
    </span>
  );
}
