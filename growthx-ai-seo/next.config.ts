import type { NextConfig } from "next";

/** The API origin the browser is allowed to talk to (fetch and socket.io). */
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").origin;
  } catch {
    return "http://localhost:3000";
  }
})();
const socketOrigin = apiOrigin.replace(/^http/, "ws");
const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy is shipped as Report-Only first: it logs violations in
 * the browser console without blocking anything, so it can be tuned against the
 * real app (Next inline bootstrap scripts, charts, socket.io) before enforcing.
 * Promote it by renaming the header to `Content-Security-Policy` once clean.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://images.unsplash.com",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${socketOrigin}${isProd ? "" : " ws://localhost:*"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" }] : []),
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/local",
        destination: "/google-business-profile",
        permanent: false,
      },
      // Billing and plans were removed; what a workspace may use is now its tokens.
      {
        source: "/billing",
        destination: "/tokens",
        permanent: false,
      },
      {
        source: "/privacy",
        destination: "/legal/privacy",
        permanent: false,
      },
      {
        source: "/terms",
        destination: "/legal/terms",
        permanent: false,
      },
      {
        source: "/security",
        destination: "/legal/security",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
