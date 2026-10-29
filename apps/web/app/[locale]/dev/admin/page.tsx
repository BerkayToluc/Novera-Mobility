import { notFound } from "next/navigation";
import { devPagesOpen } from "@/lib/dev-pages";
import { Gallery } from "./gallery";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The shared components of the admin panel on one page (V2-24), to check them at 375 / 768 / 1280 before screens use them,
// and for the tests that walk them with a keyboard. Development only, like the component gallery; the test runs open it too (lib/dev-pages.ts), which is how CI walks it.
export default async function AdminGalleryPage({ searchParams }: Props) {
  if (!devPagesOpen()) notFound();
  return <Gallery query={await searchParams} />;
}
