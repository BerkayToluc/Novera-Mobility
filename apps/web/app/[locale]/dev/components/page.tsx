import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

// Visual check for the UI primitives at 375 / 768 / 1280 before real pages use them.
export default function ComponentGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
