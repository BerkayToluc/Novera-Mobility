"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// The root of the Road Assurance steps (SPEC §2.2, after the Framer "StepProgress"): the line
// fills from one stop to the next and each stop turns into a tick as the line reaches it, once,
// when the band comes into view (G's decision), in a little over four seconds. The movement itself
// is CSS transitions in the band's markup, each piece reading its delay from --i; this only marks
// the steps unfilled on load and lets them fill when seen. Without script, or with reduced
// motion, the steps simply show complete.
export function StepProgress({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.dataset.armed = "";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        // One frame for the unfilled state to be drawn, so the fill has somewhere to start from.
        requestAnimationFrame(() => requestAnimationFrame(() => delete element.dataset.armed));
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      delete element.dataset.armed;
    };
  }, []);

  return (
    <div ref={ref} data-steps="" className={cn("group/sp", className)}>
      {children}
    </div>
  );
}
