import type { SocialNetwork } from "@/lib/company";

// Outline marks drawn on lucide's grid (24px, 2px stroke, round joins) so they sit beside
// the rest of the site's icons; lucide 1.x ships no brand icons and one row of four does
// not justify a dependency. Decorative: the network's name is written next to it.
export function SocialIcon({ network, className }: { network: SocialNetwork; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {network === "instagram" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <path d="M17.5 6.5h.01" />
        </>
      )}
      {network === "linkedin" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 11v6" />
          <path d="M8 7.5h.01" />
          <path d="M12 17v-6" />
          <path d="M12 13.5a2.5 2.5 0 0 1 5 0V17" />
        </>
      )}
      {network === "x" && (
        <>
          <path d="M4 4l16 16" />
          <path d="M20 4l-6.5 7" />
          <path d="M10.5 13 4 20" />
        </>
      )}
      {network === "youtube" && (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="4" />
          <path d="m10 9.5 4.5 2.5-4.5 2.5z" />
        </>
      )}
    </svg>
  );
}
