import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
