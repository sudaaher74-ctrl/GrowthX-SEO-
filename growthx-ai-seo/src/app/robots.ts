import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The marketing pages are public. The signed-in app is not worth crawling. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/website",
        "/competitor-intelligence",
        "/ai-visibility",
        "/google",
        "/fix-engine",
        "/reports",
        "/settings",
        "/integrations",
        "/tokens",
        "/admin",
        "/clients",
        "/analyze",
        "/auth",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
