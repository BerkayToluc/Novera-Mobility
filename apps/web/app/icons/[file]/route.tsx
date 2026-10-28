import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { BRAND_COLORS } from "@/lib/brand";

// The PNG icons of the web manifest (V2-16, QUALITY U-06): 192 and 512 px, and a maskable one. Same mark as icon.svg,
// drawn from BRAND_COLORS so a change of palette starts in one place. A maskable icon is cropped to a circle or a
// squircle by the phone, so its mark stays inside the central 60 % and the background runs to the edge.
const ICONS = {
  "icon-192.png": { size: 192, mark: 0.61 },
  "icon-512.png": { size: 512, mark: 0.61 },
  "icon-maskable-512.png": { size: 512, mark: 0.46 },
} as const;

type IconFile = keyof typeof ICONS;

export const dynamic = "force-static";

export function generateStaticParams() {
  return (Object.keys(ICONS) as IconFile[]).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!(file in ICONS)) notFound();
  const { size, mark } = ICONS[file as IconFile];
  const markSize = Math.round(size * mark);

  return new ImageResponse(
    (
      <div
        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND_COLORS.brand }}
      >
        <svg width={markSize} height={markSize} viewBox="0 0 64 64">
          <path d="M18 48V16h6l16 21V16h6v32h-6L24 27v21z" fill={BRAND_COLORS.onBrand} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
