export type StoryArtKind = "founded" | "corporate" | "assurance" | "digital" | "electric" | "expansion";

// Placeholder pictures for the six milestones (SPEC §6, §10) until photographs arrive: small
// scenes in the palette's tokens so the cards already read as the brand and follow the theme.
// Decorative; the milestone's title and text carry the meaning.
export function StoryArt({ kind, className }: { kind: StoryArtKind; className?: string }) {
  return (
    <svg viewBox="0 0 480 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="480" height="320" fill="var(--color-selected)" />
      {kind === "founded" && <Founded />}
      {kind === "corporate" && <Corporate />}
      {kind === "assurance" && <Assurance />}
      {kind === "digital" && <Digital />}
      {kind === "electric" && <Electric />}
      {kind === "expansion" && <Expansion />}
    </svg>
  );
}

const ground = <rect y="250" width="480" height="70" fill="var(--color-surface-muted)" />;

function Car({ x, y = 232, tone = "var(--color-primary)" }: { x: number; y?: number; tone?: string }) {
  return (
    <g>
      <rect x={x} y={y} width="120" height="42" rx="18" fill={tone} />
      <path d={`M${x + 20} ${y} L${x + 38} ${y - 26} H${x + 86} L${x + 104} ${y}Z`} fill={tone} />
      <path d={`M${x + 42} ${y - 20} H${x + 82} L${x + 94} ${y - 2} H${x + 30}Z`} fill="var(--color-surface)" opacity="0.8" />
      <circle cx={x + 30} cy={y + 42} r="14" fill="var(--color-fg)" />
      <circle cx={x + 92} cy={y + 42} r="14" fill="var(--color-fg)" />
      <circle cx={x + 30} cy={y + 42} r="5" fill="var(--color-surface-muted)" />
      <circle cx={x + 92} cy={y + 42} r="5" fill="var(--color-surface-muted)" />
    </g>
  );
}

// A single small garage with one car: the company started small.
function Founded() {
  return (
    <>
      <circle cx="390" cy="70" r="30" fill="var(--color-accent-soft)" />
      {ground}
      <path d="M90 250 V160 L220 110 L350 160 V250Z" fill="var(--color-primary)" opacity="0.55" />
      <rect x="130" y="180" width="180" height="70" fill="var(--color-surface)" />
      <Car x={160} y={206} />
    </>
  );
}

// An office block: the first company fleets.
function Corporate() {
  return (
    <>
      {ground}
      <rect x="120" y="70" width="130" height="180" fill="var(--color-band)" />
      <rect x="260" y="120" width="100" height="130" fill="var(--color-primary)" />
      {[140, 175, 210].flatMap((x) =>
        [95, 130, 165, 200].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="18" height="18" rx="3" fill="var(--color-band-accent)" opacity="0.85" />),
      )}
      {[280, 315].flatMap((x) =>
        [145, 180, 215].map((y) => <rect key={`b${x}-${y}`} x={x} y={y} width="18" height="18" rx="3" fill="var(--color-surface)" opacity="0.8" />),
      )}
    </>
  );
}

// A road and a shield: Road Assurance for every rental.
function Assurance() {
  return (
    <>
      {ground}
      <path d="M0 292 C120 270 260 280 480 262" fill="none" stroke="var(--color-border-strong)" strokeWidth="6" strokeDasharray="22 18" />
      <path d="M240 50 L330 82 V150 C330 200 290 232 240 252 C190 232 150 200 150 150 V82Z" fill="var(--color-primary)" />
      <path d="M200 150 L230 180 L282 120" fill="none" stroke="var(--color-on-primary)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// A phone with a camera frame: the digital damage report.
function Digital() {
  return (
    <>
      {ground}
      <rect x="170" y="40" width="140" height="240" rx="24" fill="var(--color-band)" />
      <rect x="182" y="64" width="116" height="190" rx="10" fill="var(--color-surface)" />
      <Car x={188} y={150} tone="var(--color-primary)" />
      <path d="M194 84 h22 M194 84 v22 M286 84 h-22 M286 84 v22 M194 236 h22 M194 236 v-22 M286 236 h-22 M286 236 v-22" fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" />
    </>
  );
}

// A car at a charging post: the first electric and hybrid cars.
function Electric() {
  return (
    <>
      {ground}
      <rect x="320" y="110" width="64" height="140" rx="12" fill="var(--color-primary)" />
      <rect x="334" y="126" width="36" height="28" rx="5" fill="var(--color-selected)" />
      <path d="M355 130 L345 144 H353 L348 154 L362 140 H354Z" fill="var(--color-primary)" />
      <path d="M320 200 C280 200 270 240 290 252" fill="none" stroke="var(--color-primary)" strokeWidth="7" strokeLinecap="round" />
      <Car x={140} y={208} tone="var(--color-accent)" />
    </>
  );
}

// A map of dots joined by a route: the branch network.
function Expansion() {
  const points = [
    [90, 210],
    [170, 150],
    [250, 190],
    [320, 110],
    [400, 160],
  ];
  return (
    <>
      <path d="M40 260 C120 230 160 270 240 250 S380 230 450 250 V320 H40Z" fill="var(--color-primary)" opacity="0.35" />
      <path d={`M${points.map((p) => p.join(" ")).join(" L")}`} fill="none" stroke="var(--color-primary)" strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round" />
      {points.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="16" fill="var(--color-surface)" />
          <circle cx={x} cy={y} r="8" fill="var(--color-accent)" />
        </g>
      ))}
    </>
  );
}
