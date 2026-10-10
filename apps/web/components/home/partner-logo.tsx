import { cn } from "@/lib/cn";
import type { Partner, PartnerMark } from "@/lib/partners";

// One fictional partner's wordmark: a drawn mark beside the name set in the site's face.
// The name is real text, so a screen reader reads the company and the strip needs no alt text.
export function PartnerLogo({ partner }: { partner: Partner }) {
  return (
    <span className="inline-flex items-center gap-3">
      <PartnerMarkIcon mark={partner.mark} className="size-8 shrink-0" />
      <span
        className={cn(
          "whitespace-nowrap",
          partner.style === "caps" && "text-label uppercase tracking-widest",
          partner.style === "plain" && "text-h3",
          partner.style === "light" && "text-body lowercase tracking-wide",
        )}
      >
        {partner.name}
      </span>
    </span>
  );
}

// Marks on a 32px grid with a 2.5px stroke, drawn rather than borrowed from any real brand.
function PartnerMarkIcon({ mark, className }: { mark: PartnerMark; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {mark === "sun" && (
        <>
          <circle cx="16" cy="13" r="6" />
          <path d="M4 25h24" />
          <path d="M9 29h14" />
        </>
      )}
      {mark === "wind" && (
        <>
          <path d="M4 11h15a4 4 0 1 0-4-4" />
          <path d="M4 17h21a4 4 0 1 1-4 4" />
          <path d="M4 23h9" />
        </>
      )}
      {mark === "wave" && (
        <>
          <path d="M4 20c3-4 6-4 9 0s6 4 9 0 4-3 6-2" />
          <path d="M4 26c3-4 6-4 9 0s6 4 9 0 4-3 6-2" />
          <circle cx="22" cy="9" r="3" />
        </>
      )}
      {mark === "peak" && (
        <>
          <path d="M3 27 13 9l6 10 3-5 7 13Z" />
        </>
      )}
      {mark === "cross" && (
        <>
          <rect x="4" y="4" width="24" height="24" rx="7" />
          <path d="M16 10v12" />
          <path d="M10 16h12" />
        </>
      )}
      {mark === "arch" && (
        <>
          <path d="M6 28V15a10 10 0 0 1 20 0v13" />
          <path d="M12 28v-9a4 4 0 0 1 8 0v9" />
          <path d="M3 28h26" />
        </>
      )}
      {mark === "tree" && (
        <>
          <circle cx="16" cy="12" r="8" />
          <path d="M16 20v9" />
          <path d="M11 29h10" />
        </>
      )}
      {mark === "box" && (
        <>
          <path d="M16 3 28 9v14L16 29 4 23V9Z" />
          <path d="M4 9l12 6 12-6" />
          <path d="M16 15v14" />
        </>
      )}
    </svg>
  );
}
