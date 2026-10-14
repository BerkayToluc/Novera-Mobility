"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// The line that runs through the Road Assurance steps (SPEC §2.2, §5.4), after the Framer
// "AnimatedPath": a faint dashed road, and a short bright trail that runs along it. The trail
// starts when the line scrolls into view, runs along twice in under five seconds and rests, so
// it never moves long enough to need a pause control (WCAG 2.2.2); with reduced motion it does
// not run at all. A straight line, because the steps stand in a row or a column; the original's
// curve is a fixed diagram. Decorative: the steps say everything in text.
//
// The SVG is stretched to its box (`preserveAspectRatio="none"`) and only the length scales: the
// line is drawn in a 4-unit-thick strip, so its width stays what it is, and `pathLength={1}`
// makes every dash a fraction of the line whatever its length on screen.
export function AnimatedPath({ orientation, className }: { orientation: "vertical" | "horizontal"; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const vertical = orientation === "vertical";
  const path = vertical ? "M2 0 V100" : "M0 2 H100";

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      focusable="false"
      viewBox={vertical ? "0 0 4 100" : "0 0 100 4"}
      preserveAspectRatio="none"
      className={cn(vertical ? "w-1" : "h-1", "overflow-visible", className)}
    >
      <path d={path} pathLength={1} strokeWidth={2} strokeDasharray="0.012 0.012" className="fill-none stroke-on-band/40" />
      {/* The trail: a dash a quarter of the line long, parked just before the start until it runs. */}
      <path
        d={path}
        pathLength={1}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="0.25 1.25"
        strokeDashoffset={0.25}
        className={cn("fill-none stroke-band-accent", started && "animate-road-trail motion-reduce:animate-none")}
      />
    </svg>
  );
}
