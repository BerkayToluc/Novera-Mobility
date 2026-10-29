import { isMockMode } from "@/lib/mode";

// The pictures the panel uploaded in sample mode (USE_MOCKS=1, mocks/uploads.ts), standing in for the photo store. On a real
// site this answers 404 to everything: it is never reachable there, whatever is asked for.
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!isMockMode()) return new Response("Not found", { status: 404 });
  const { name } = await params;
  const picture = (await import("@/mocks/uploads")).getMockUpload(name);
  if (!picture) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(picture), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
