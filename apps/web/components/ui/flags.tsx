import type { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];

// A round flag for each language (SPEC §2.8). Inline SVG on purpose: flag emoji are drawn as
// the two letters "TR" on Windows. The colours are the flags' own, not theme tokens, so they
// stay as they are in the dark theme too. Decorative: the language's name always sits beside it.
const FLAGS = {
  tr: (
    <>
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="10.5" cy="10" r="5" fill="#FFFFFF" />
      <circle cx="11.9" cy="10" r="4" fill="#E30A17" />
      <polygon
        fill="#FFFFFF"
        points="19.5,10 17.674,10.635 17.634,12.568 16.466,11.027 14.616,11.587 15.72,10 14.616,8.413 16.466,8.973 17.634,7.432 17.674,9.365"
      />
    </>
  ),
  en: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="1" />
      <path d="M15,0 V20 M0,10 H30" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3" />
    </>
  ),
} as const satisfies Record<Locale, React.ReactNode>;

export function Flag({ locale }: { locale: Locale }) {
  return (
    <span className="inline-flex size-6 shrink-0 overflow-hidden rounded-full border border-border">
      <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className="size-full">
        {FLAGS[locale]}
      </svg>
    </span>
  );
}
