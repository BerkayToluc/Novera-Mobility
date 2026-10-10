import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Novera Mobility";

// The preview shown when a link is shared: the white logo on the brand green. It carries no
// text of its own, so it is right in both languages and needs no font.
export default async function OpenGraphImage() {
  const svg = await readFile(path.join(process.cwd(), "public", "brand", "novera-logo-white.svg"));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#45561d" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={720} height={198} />
      </div>
    ),
    size,
  );
}
