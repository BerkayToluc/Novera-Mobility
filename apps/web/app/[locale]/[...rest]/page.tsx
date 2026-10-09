import { notFound } from "next/navigation";

// Any URL no page matches ends up here, so the 404 is rendered inside the locale
// layout (header, footer, language) instead of Next's unstyled default.
export default function CatchAllPage() {
  notFound();
}
