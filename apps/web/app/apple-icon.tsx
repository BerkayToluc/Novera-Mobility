import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as icon.svg; iOS needs a PNG, so it is drawn here instead of kept as a file.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1d5a40" }}>
        <svg width="110" height="110" viewBox="0 0 64 64">
          <path d="M18 48V16h6l16 21V16h6v32h-6L24 27v21z" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
