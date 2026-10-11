"use client";

import { useEffect, useRef } from "react";
import { useFormatter } from "next-intl";

// A number that counts up once, when it scrolls into view (SPEC §2.7, after the Framer
// StatsSection): about two seconds, slowing toward the end. The final value is what the server
// renders and what a screen reader hears; the counting only repaints the visible copy, so
// without script, with reduced motion, or for assistive technology the true number is there from
// the start. The text is written to the DOM directly: a state update per frame would re-render.
export function CountUp({ value, duration = 2000 }: { value: number; duration?: number }) {
  const format = useFormatter();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    // Fast at first, easing out: the last digits settle instead of stopping dead.
    const easeOutExpo = (progress: number) => (progress >= 1 ? 1 : 1 - 2 ** (-10 * progress));
    const show = (n: number) => {
      element.textContent = format.number(Math.round(n));
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
  }, [value, duration, format]);

  return (
    <span aria-label={format.number(value)} className="tabular-nums">
      <span ref={ref} aria-hidden="true">
        {format.number(value)}
      </span>
    </span>
  );
}
