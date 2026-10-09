// The accent is used sparingly (SPEC §5.1): this badge is one of its few places.
export function ProductBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-small text-on-accent-soft">
      {children}
    </span>
  );
}
