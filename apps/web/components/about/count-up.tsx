"use client";

import { useEffect, useRef } from "react";
import { useFormatter } from "next-intl";

function formatCount(format: ReturnType<typeof useFormatter>, n: number, percent: boolean) {
  return percent ? format.number(Math.round(n * 100) / 100, { style: "percent" }) : format.number(Math.round(n));
}

// A number that counts up once, when it scrolls into view (SPEC §2.7, after the Framer
// StatsSection): about two seconds, slowing toward the end. The final value is what the server
// renders and what a screen reader hears; the counting only repaints the visible copy, so
// without script, with reduced motion, or for assistive technology the true number is there from
// the start. The text is written to the DOM directly: a state update per frame would re-render.
// A share (0.18) is shown as a percentage and counts in whole points (0 %, 1 %, … 18 %).
export function CountUp({ value, duration = 2000, percent = false }: { value: number; duration?: number; percent?: boolean }) {
  const format = useFormatter();
  const text = (n: number) => formatCount(format, n, percent);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    // Fast at first, easing out: the last digits settle instead of stopping dead.
    const easeOutExpo = (progress: number) => (progress >= 1 ? 1 : 1 - 2 ** (-10 * progress));
    const show = (n: number) => {
      element.textContent = formatCount(format, n, percent);
    };

    show(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const startedAt = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - startedAt) / duration, 1);
          show(value * easeOutExpo(progress));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      show(value);
    };
  }, [value, duration, format, percent]);

  return (
    <span className="tabular-nums">
      {/* The final figure is what a screen reader gets; the counting one is hidden from it
          (an aria-label is not allowed on a plain span). */}
      <span className="sr-only">{text(value)}</span>
      <span ref={ref} aria-hidden="true">
        {text(value)}
      </span>
    </span>
  );
}
