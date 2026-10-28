"use client";

import { useId, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/cn";

export type FaqQuestion = { id: string; question: string; answer: string };

type FaqTabsProps = {
  // Names the group of category buttons for assistive technology ("Konular").
  label: string;
  // Category key to its label, in the order the tabs are shown.
  categories: Record<string, string>;
  // The questions of each category key.
  faqData: Record<string, FaqQuestion[]>;
  className?: string;
};

// A FAQ with category tabs (SPEC §2.2.5), after the "FAQ with tabs" component: the chosen tab fills
// from below, the list slides in, and the open row turns its plus a quarter turn. Rebuilt on the
// site's tokens (no gradients or glow, 44 px targets, the focus ring) and with every row a real
// button that says whether it is open. The rows are stacked cards (after the Framer "FAQs"
// component): one answer open at a time, its plus folding into a minus, the answer opening on a
// firm spring. With reduced
// motion the movement is dropped and only the fade stays (MotionConfig). A closed answer is not
// in the page at all, so a screen reader or the Tab key never lands in hidden text; the price is
// that the browser's find-in-page does not see it.
export function FaqTabs({ label, categories, faqData, className }: FaqTabsProps) {
  const keys = Object.keys(categories);
  const [selected, setSelected] = useState(keys[0]);
  const panelId = useId();
  const questions = faqData[selected] ?? [];
  // The first question of a category starts open, so an answer is already in sight.
  const [openId, setOpenId] = useState<string | null>(questions[0]?.id ?? null);
  const choose = (key: string) => {
    setSelected(key);
    setOpenId(faqData[key]?.[0]?.id ?? null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("flex flex-col gap-6", className)}>
        <div role="group" aria-label={label} className="flex flex-wrap gap-2">
          {keys.map((key) => {
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                aria-controls={panelId}
                onClick={() => choose(key)}
                className={cn(
                  "relative isolate inline-flex min-h-11 items-center overflow-hidden whitespace-nowrap rounded-full border px-4 text-label transition-colors duration-500",
                  active ? "border-primary text-on-primary" : "border-border-strong bg-surface text-fg hover:bg-selected",
                )}
              >
                {categories[key]}
                <AnimatePresence>
                  {active && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ y: "100%" }}
                      animate={{ y: "0%" }}
                      exit={{ y: "100%" }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                      className="absolute inset-0 -z-10 bg-primary"
                    />
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        <div id={panelId} role="region" aria-label={categories[selected]}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={selected}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-0.5 rounded-card bg-surface-muted p-1"
            >
              {questions.map((item) => (
                <FaqRow
                  key={item.id}
                  {...item}
                  open={openId === item.id}
                  onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
                />
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

const ROW_SPRING = { type: "spring", stiffness: 500, damping: 60, mass: 1 } as const;

function FaqRow({
  question,
  answer,
  open,
  onToggle,
}: Omit<FaqQuestion, "id"> & { open: boolean; onToggle: () => void }) {
  const answerId = useId();

  return (
    <li className="rounded-card border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-6 rounded-card px-6 py-5 text-left"
      >
        <span className="text-body font-semibold text-fg">{question}</span>
        {/* A plus of two thin bars; open, the upright one turns flat and the plus is a minus. */}
        <span aria-hidden="true" className="relative inline-flex size-7 shrink-0 items-center justify-center text-fg-muted">
          <span className="absolute h-px w-3 bg-current" />
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={ROW_SPRING} className="absolute h-3 w-px bg-current" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={answerId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={ROW_SPRING}
            className="overflow-hidden"
          >
            <p className="max-w-prose px-6 pb-6 text-body text-fg-muted">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
