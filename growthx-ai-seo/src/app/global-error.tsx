"use client";

/**
 * Last-resort boundary: catches failures in the root layout itself, which the
 * other error files sit inside of and therefore cannot catch.
 *
 * This file replaces the root layout when it renders, so globals.css and the
 * font variables never reach it — every style here has to be inline, and the
 * document tags have to be written out by hand.
 */

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "16px",
        }}
      >
        <title>Something went wrong | GrowthX AI SEO</title>
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            padding: "28px",
            textAlign: "center",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 800, letterSpacing: "-0.01em" }}>
            GrowthX hit an unexpected error
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: "12.5px", lineHeight: 1.6, color: "#64748b" }}>
            The app failed to start up. Trying again usually clears it — if it keeps happening,
            send us the reference below.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "20px 0 0",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                padding: "8px 12px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "11px",
                color: "#64748b",
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "24px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#9333ea",
              padding: "9px 16px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
