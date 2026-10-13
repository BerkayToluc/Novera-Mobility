"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check, Copy, Mail, Phone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

// An e-mail address or phone number that offers a choice (SPEC §2.6, after the Framer "Smart
// Contact Link"): pressed, a small bubble opens above it with "Send e-mail" (or "Call") and
// "Copy", so a visitor without a mail app set up is not left with a dead click. "@" makes it an
// e-mail address. The bubble springs open, slides sideways rather than leave the screen, and
// closes on a click outside, on Escape (focus back on the trigger) or when Tab leaves it; a copy
// is confirmed in place and announced. A disclosure, not a menu: the two choices are a link and
// a button, reached with Tab.
const EDGE_PX = 12;
const SPRING = { type: "spring", stiffness: 500, damping: 34, mass: 1 } as const;

export function ContactLink({
  value,
  label,
  className,
  icon = true,
}: {
  value: string;
  // What the trigger shows; the address itself by default.
  label?: ReactNode;
  className?: string;
  icon?: boolean;
}) {
  const t = useTranslations("ContactLink");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shift, setShift] = useState(0);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const popupId = useId();

  const isEmail = value.includes("@");
  const href = isEmail ? `mailto:${value}` : `tel:${value.replace(/[^\d+]/g, "")}`;
  const heading = t(isEmail ? "emailHeading" : "phoneHeading");
  const Icon = isEmail ? Mail : Phone;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Kept inside the screen: offsetWidth ignores the opening scale, so the measure is the real one.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const popup = popupRef.current;
      const root = rootRef.current;
      if (!popup || !root) return;
      const left = root.getBoundingClientRect().left;
      const width = popup.offsetWidth;
      const room = document.documentElement.clientWidth;
      let dx = 0;
      if (left + width > room - EDGE_PX) dx = room - EDGE_PX - (left + width);
      if (left + dx < EDGE_PX) dx = EDGE_PX - left;
      setShift(Math.round(dx));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  async function copy() {
    let done = false;
    try {
      await navigator.clipboard.writeText(value);
      done = true;
    } catch {
      // No clipboard permission (or not a secure page): the old way, through a hidden field.
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.className = "fixed top-0 opacity-0";
      document.body.appendChild(field);
      field.select();
      done = document.execCommand("copy");
      field.remove();
    }
    if (!done) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }

  const choice =
    "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control bg-surface-muted px-3.5 text-label text-fg transition-[background-color,scale] duration-150 hover:bg-selected active:scale-97";

  return (
    <MotionConfig reducedMotion="user">
      <span
        ref={rootRef}
        className="relative inline-flex max-w-full"
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && !event.currentTarget.contains(next)) setOpen(false);
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          onClick={() => setOpen((value) => !value)}
          className={cn("inline-flex min-h-11 max-w-full items-center gap-3 text-left", className)}
        >
          {icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
          <span className="min-w-0 truncate">{label ?? value}</span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popupRef}
              id={popupId}
              role="group"
              aria-label={heading}
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 6 }}
              transition={SPRING}
              style={{ x: shift }}
              className="absolute bottom-full left-0 z-50 mb-3 w-max origin-bottom-left rounded-card border border-border bg-surface p-2 text-fg shadow-overlay"
            >
              {/* The point of the bubble, moved back by the shift so it stays over the trigger. */}
              <span
                aria-hidden="true"
                style={{ transform: `translateX(${-shift}px) rotate(45deg)` }}
                className="absolute -bottom-1.5 left-5 size-3 border-b border-r border-border bg-surface"
              />
              <p className="px-2 pb-2 pt-1 text-small font-semibold text-fg-muted">{heading}</p>
              <div className="relative grid auto-cols-fr grid-flow-col gap-1.5">
                <a href={href} onClick={() => (timer.current = setTimeout(() => setOpen(false), 150))} className={choice}>
                  {isEmail ? <Send aria-hidden="true" className="size-4" /> : <Phone aria-hidden="true" className="size-4" />}
                  {t(isEmail ? "send" : "call")}
                </a>
                <button type="button" onClick={copy} className={choice}>
                  {copied ? <Check aria-hidden="true" className="size-4 text-success" /> : <Copy aria-hidden="true" className="size-4" />}
                  {copied ? t("copied") : t(isEmail ? "copyEmail" : "copyPhone")}
                </button>
              </div>
              <span role="status" className="sr-only">
                {copied ? t("copied") : ""}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </span>
    </MotionConfig>
  );
}
