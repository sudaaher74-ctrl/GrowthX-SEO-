import { ImageResponse } from "next/og";

// ImageResponse renders outside the page CSS, so it cannot use the theme tokens.
// These literals mirror --color-brand-950, -50 and -400 in globals.css.
export const alt = "GrowthX: find what's costing you customers, then fix it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#09090b",
          color: "#fafafa",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 40 }}>GrowthX</div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>Find it. Fix it. Prove it.</div>
        <div style={{ fontSize: 32, marginTop: 32, color: "#a1a1aa" }}>
          SEO audit, rival tracking, AI answers and Google Maps, in one ranked queue.
        </div>
      </div>
    ),
    size,
  );
}
