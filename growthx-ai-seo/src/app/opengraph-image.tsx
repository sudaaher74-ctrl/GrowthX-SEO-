import { ImageResponse } from "next/og";

// ImageResponse renders outside the page CSS, so it cannot use theme CSS variables.
// RGB values mirror --color-brand-950/900/800/400/50 and --color-signal-400/ink in globals.css.
export const alt =
  "Reigel AI SEO — Find what's costing you customers, ship safe fixes to GitHub & CMS, and prove every win.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PILLS = [
  "WordPress · Shopify · Webflow · GitHub",
  "5 Official AI APIs",
  "1-Click Safe Rollback",
  "White-Label Client Portals",
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "rgb(9, 9, 11)",
          color: "rgb(250, 250, 250)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top brand bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "rgb(200, 245, 58)",
                color: "rgb(16, 19, 10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              R
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em" }}>Reigel</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgb(161, 161, 170)",
                  border: "1px solid rgb(39, 39, 42)",
                  background: "rgb(24, 24, 27)",
                  padding: "6px 12px",
                  borderRadius: 8,
                }}
              >
                AI SEO
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 18,
              fontWeight: 700,
              color: "rgb(200, 245, 58)",
              border: "1px solid rgb(39, 39, 42)",
              background: "rgb(24, 24, 27)",
              padding: "10px 18px",
              borderRadius: 999,
            }}
          >
            <span>reigel.in</span>
          </div>
        </div>

        {/* Center headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 74,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            <span>Find it.</span>
            <span style={{ color: "rgb(200, 245, 58)" }}>Fix it.</span>
            <span>Prove it.</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, lineHeight: 1.38, color: "rgb(161, 161, 170)", maxWidth: 960 }}>
            Headless SEO audits, AI citation tracking, Grounded Content Studio, direct CMS &amp; GitHub batch fixes, and zero-login white-label client portals.
          </div>
        </div>

        {/* Bottom capability pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {PILLS.map((pill) => (
            <div
              key={pill}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 17,
                fontWeight: 700,
                color: "rgb(244, 244, 245)",
                background: "rgb(24, 24, 27)",
                border: "1px solid rgb(39, 39, 42)",
                padding: "10px 18px",
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "rgb(200, 245, 58)",
                }}
              />
              <span>{pill}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
