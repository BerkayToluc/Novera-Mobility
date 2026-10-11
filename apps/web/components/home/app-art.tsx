// A placeholder for the mobile-app photograph (SPEC §2.9, §6, §10): two phones showing the two
// things the Novera Driver App is for, the damage photo at hand-over and the SOS button, drawn
// in the palette's tokens until a real photograph arrives. Decorative; the section's text
// says what the app does.
export function AppArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="520" height="440" fill="var(--color-selected)" />
      <circle cx="420" cy="90" r="46" fill="var(--color-accent-soft)" />
      <path d="M0 360 C120 320 220 350 340 330 S480 320 520 330 V440 H0Z" fill="var(--color-primary)" opacity="0.35" />

      {/* Back phone: the damage photo taken when the key is handed over. */}
      <g transform="rotate(-6 190 230)">
        <rect x="90" y="60" width="200" height="330" rx="30" fill="var(--color-band)" />
        <rect x="104" y="90" width="172" height="278" rx="14" fill="var(--color-surface)" />
        <rect x="116" y="108" width="148" height="120" rx="10" fill="var(--color-selected)" />
        <rect x="150" y="160" width="80" height="30" rx="14" fill="var(--color-primary)" />
        <path d="M164 160 L174 140 H206 L216 160Z" fill="var(--color-primary)" />
        <circle cx="168" cy="192" r="9" fill="var(--color-fg)" />
        <circle cx="212" cy="192" r="9" fill="var(--color-fg)" />
        <path d="M122 126 h18 M122 126 v18 M258 126 h-18 M258 126 v18 M122 210 h18 M122 210 v-18 M258 210 h-18 M258 210 v-18" fill="none" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" />
        <rect x="116" y="244" width="148" height="12" rx="6" fill="var(--color-border)" />
        <rect x="116" y="266" width="100" height="12" rx="6" fill="var(--color-border)" />
        <rect x="116" y="304" width="148" height="40" rx="12" fill="var(--color-primary)" />
      </g>

      {/* Front phone: the one-tap SOS. */}
      <g transform="rotate(5 340 250)">
        <rect x="250" y="90" width="200" height="330" rx="30" fill="var(--color-fg)" />
        <rect x="264" y="120" width="172" height="278" rx="14" fill="var(--color-surface)" />
        <circle cx="350" cy="236" r="62" fill="var(--color-accent-soft)" />
        <circle cx="350" cy="236" r="42" fill="var(--color-accent)" />
        <path d="M350 214 v28 M350 256 v.01" fill="none" stroke="var(--color-on-primary)" strokeWidth="10" strokeLinecap="round" />
        <rect x="290" y="326" width="120" height="12" rx="6" fill="var(--color-border)" />
        <rect x="310" y="348" width="80" height="12" rx="6" fill="var(--color-border)" />
      </g>
    </svg>
  );
}
