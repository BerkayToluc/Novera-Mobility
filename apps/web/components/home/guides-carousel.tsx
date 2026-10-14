"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// The guide cards in a row you slide, with an arrow at each side (SPEC §2.9). The cards sit in a
// native scroll-snap strip, so a finger, a trackpad and the keyboard already scroll it; the
// arrows move it one card. The cards arrive as children because they are built on the server.
// The arrows sit in the page's side margin from md up; on a phone the strip is inset to leave
// them room beside the card. An arrow at the end of the strip is marked unavailable rather than disabled: a disabled button
// would drop the focus a keyboard visitor was on. Nothing wraps around.
export function GuidesCarousel({ children }: { children: ReactNode }) {
  const t = useTranslations("GuidesPage.carousel");
  const stripRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    setAtStart(strip.scrollLeft <= 1);
    setAtEnd(strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // One card at a time; the card's own width is the step, so it holds at every breakpoint.
  function slide(direction: -1 | 1) {
    const strip = stripRef.current;
    const card = strip?.querySelector("li");
    if (!strip || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollBy({ left: direction * card.getBoundingClientRect().width, behavior: reduce ? "auto" : "smooth" });
  }

  const arrow = "absolute top-1/2 z-10 -translate-y-1/2 bg-surface shadow-overlay aria-disabled:cursor-default aria-disabled:text-fg-subtle aria-disabled:shadow-none";

  return (
    <div role="group" aria-roledescription={t("roledescription")} aria-label={t("label")} className="relative px-5 md:px-0">
      <ul
        ref={stripRef}
        onScroll={measure}
        // Room above and below for a card that lifts and casts its shadow on hover; a scrolling strip
        // clips both directions.
        className="-mx-3 -my-3 flex snap-x snap-mandatory overflow-x-auto py-3 [scrollbar-width:none]"
      >
        {children}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="icon"
        shape="pill"
        aria-label={t("previous")}
        aria-disabled={atStart}
        onClick={() => !atStart && slide(-1)}
        className={`${arrow} left-0 md:-left-8 xl:-left-14`}
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        shape="pill"
        aria-label={t("next")}
        aria-disabled={atEnd}
        onClick={() => !atEnd && slide(1)}
        className={`${arrow} right-0 md:-right-8 xl:-right-14`}
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </Button>
    </div>
  );
}
