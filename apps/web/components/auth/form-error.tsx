// A failure of the whole submission (not one field). `role="alert"` makes a screen
// reader announce it as soon as it appears.
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control border border-error p-3 text-small text-error">
      {message}
    </p>
  );
}
