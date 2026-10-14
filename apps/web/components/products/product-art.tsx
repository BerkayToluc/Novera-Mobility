import type { ProductSlug } from "@/lib/products";

// A drawing for each product (SPEC §2.5), in the palette's tokens so it follows the theme, until
// real artwork arrives: the fleet's panel, a prestige car under a star, a calendar with a clock,
// a leaf with a charging bolt. Decorative; the product's name is always written beside it.
export function ProductArt({ slug, className }: { slug: ProductSlug; className?: string }) {
  return (
    <svg viewBox="0 0 240 240" fill="none" aria-hidden="true" className={className}>
      {slug === "akilli-kurumsal-filo" && (
        <>
          <rect x="28" y="44" width="184" height="132" rx="18" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="2" />
          <rect x="28" y="44" width="184" height="26" rx="13" fill="var(--color-primary)" />
          <circle cx="46" cy="57" r="4" fill="var(--color-on-primary)" />
          <circle cx="60" cy="57" r="4" fill="var(--color-on-primary)" opacity="0.6" />
          <rect x="48" y="122" width="18" height="38" rx="5" fill="var(--color-primary)" />
          <rect x="74" y="100" width="18" height="60" rx="5" fill="var(--color-primary)" opacity="0.75" />
          <rect x="100" y="112" width="18" height="48" rx="5" fill="var(--color-primary)" opacity="0.5" />
          <path d="M136 146c14-6 20-30 34-30s18 16 26 10" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="170" cy="198" r="22" fill="var(--color-accent)" />
          <path d="M160 200h20M164 192h12l4 8M160 206h2m16 0h2" stroke="var(--color-on-primary)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {slug === "vip-mobilite" && (
        <>
          <circle cx="120" cy="104" r="76" fill="var(--color-accent-soft)" />
          <path d="m120 50 10 22 24 2-18 16 6 24-22-13-22 13 6-24-18-16 24-2Z" fill="var(--color-primary)" />
          <path d="M44 176c4-14 16-22 30-24l24-16h48l26 16c14 2 24 10 24 24v10H44Z" fill="var(--color-primary)" />
          <path d="M104 144h36l14 10H90Z" fill="var(--color-surface)" opacity="0.8" />
          <circle cx="82" cy="188" r="14" fill="var(--color-fg)" />
          <circle cx="160" cy="188" r="14" fill="var(--color-fg)" />
          <circle cx="82" cy="188" r="5" fill="var(--color-surface)" />
          <circle cx="160" cy="188" r="5" fill="var(--color-surface)" />
        </>
      )}
      {slug === "esnek-kisa-donem" && (
        <>
          <rect x="34" y="48" width="150" height="140" rx="18" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="2" />
          <rect x="34" y="48" width="150" height="34" rx="17" fill="var(--color-accent)" />
          <rect x="62" y="36" width="8" height="24" rx="4" fill="var(--color-fg)" />
          <rect x="148" y="36" width="8" height="24" rx="4" fill="var(--color-fg)" />
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={54 + col * 30}
                y={98 + row * 22}
                width="16"
                height="12"
                rx="4"
                fill={row === 1 && col === 2 ? "var(--color-primary)" : "var(--color-border)"}
              />
            )),
          )}
          <circle cx="178" cy="176" r="38" fill="var(--color-selected)" stroke="var(--color-primary)" strokeWidth="5" />
          <path d="M178 156v22l14 8" stroke="var(--color-primary)" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {slug === "yesil-filo" && (
        <>
          <circle cx="120" cy="120" r="84" fill="var(--color-selected)" />
          <path d="M66 172c0-62 44-108 118-112 0 74-46 118-108 118-4 0-7-2-10-6Z" fill="var(--color-primary)" />
          <path d="M76 168c22-30 48-54 82-72" stroke="var(--color-selected)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="182" cy="182" r="28" fill="var(--color-accent)" />
          <path d="m186 164-14 22h12l-4 16 14-22h-12Z" fill="var(--color-on-primary)" />
        </>
      )}
    </svg>
  );
}
