export type CampaignArtKind = "weekend" | "electric" | "fleet";

// Placeholder scenes for the campaign gallery until real photographs arrive (SPEC §6, §10).
// Drawn from the palette's tokens rather than grey boxes, so the slides already read as the
// brand and switch with the theme. Decorative: each slide's heading says what it is about.
export function CampaignArt({ kind, className }: { kind: CampaignArtKind; className?: string }) {
  return (
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      {kind === "weekend" && <Weekend />}
      {kind === "electric" && <Electric />}
      {kind === "fleet" && <Fleet />}
    </svg>
  );
}

// A road winding out through olive hills, the sun low over the ridge.
function Weekend() {
  return (
    <>
      <rect width="640" height="400" fill="var(--color-selected)" />
      <circle cx="470" cy="150" r="58" fill="var(--color-accent-soft)" />
      <path d="M0 250 C120 190 220 210 320 230 S520 200 640 215 V400 H0Z" fill="var(--color-primary)" opacity="0.55" />
      <path d="M0 300 C140 250 260 280 380 270 S560 250 640 262 V400 H0Z" fill="var(--color-primary)" />
      <path d="M250 400 C300 340 360 310 430 286 L452 286 C392 314 344 348 312 400Z" fill="var(--color-surface-muted)" />
      <path
        d="M282 400 C320 352 370 318 440 288"
        fill="none"
        stroke="var(--color-on-primary)"
        strokeWidth="4"
        strokeDasharray="14 16"
        strokeLinecap="round"
      />
    </>
  );
}

// A charging post beside the road, its cable running to the plug.
function Electric() {
  return (
    <>
      <rect width="640" height="400" fill="var(--color-accent-soft)" />
      <path d="M0 270 C160 230 300 250 420 240 S580 228 640 236 V400 H0Z" fill="var(--color-accent)" opacity="0.35" />
      <rect x="0" y="318" width="640" height="82" fill="var(--color-surface-muted)" />
      <path d="M0 359 H640" stroke="var(--color-border-strong)" strokeWidth="4" strokeDasharray="22 18" />
      <rect x="402" y="150" width="76" height="168" rx="14" fill="var(--color-primary)" />
      <rect x="418" y="170" width="44" height="34" rx="6" fill="var(--color-selected)" />
      <path d="M444 176 L432 192 H442 L436 204 L452 186 H442 Z" fill="var(--color-primary)" />
      <path
        d="M478 240 C540 240 548 300 500 318"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <rect x="152" y="252" width="190" height="62" rx="24" fill="var(--color-band)" />
      <path d="M182 252 L210 216 H290 L320 252Z" fill="var(--color-band)" />
      <path d="M216 224 H286 L304 248 H200Z" fill="var(--color-accent-soft)" opacity="0.8" />
      <circle cx="198" cy="316" r="20" fill="var(--color-fg)" />
      <circle cx="300" cy="316" r="20" fill="var(--color-fg)" />
      <circle cx="198" cy="316" r="8" fill="var(--color-surface-muted)" />
      <circle cx="300" cy="316" r="8" fill="var(--color-surface-muted)" />
    </>
  );
}

// Three cars lined up for delivery to a company's door.
function Fleet() {
  const cars = [
    { x: 64, tone: "var(--color-primary)" },
    { x: 248, tone: "var(--color-band)" },
    { x: 432, tone: "var(--color-accent)" },
  ];
  return (
    <>
      <rect width="640" height="400" fill="var(--color-surface-muted)" />
      <rect x="0" y="290" width="640" height="110" fill="var(--color-selected)" />
      <path d="M0 292 H640" stroke="var(--color-border-strong)" strokeWidth="3" />
      {cars.map(({ x, tone }) => (
        <g key={x}>
          <rect x={x} y="214" width="144" height="56" rx="22" fill={tone} />
          <path d={`M${x + 22} 214 L${x + 44} 182 H${x + 104} L${x + 126} 214Z`} fill={tone} />
          <path d={`M${x + 48} 190 H${x + 100} L${x + 114} 210 H${x + 36}Z`} fill="var(--color-surface)" opacity="0.75" />
          <circle cx={x + 34} cy="272" r="17" fill="var(--color-fg)" />
          <circle cx={x + 110} cy="272" r="17" fill="var(--color-fg)" />
          <circle cx={x + 34} cy="272" r="7" fill="var(--color-surface-muted)" />
          <circle cx={x + 110} cy="272" r="7" fill="var(--color-surface-muted)" />
        </g>
      ))}
    </>
  );
}
