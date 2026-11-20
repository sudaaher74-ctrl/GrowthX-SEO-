import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The marketing pages are public. Signed-in workspaces and private client portal links must never be crawled. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/website",
        "/organic-search",
        "/traffic",
        "/competitor-intelligence",
        "/backlinks",
        "/ai-visibility",
        "/google",
        "/google-business-profile",
        "/fix-engine",
        "/monthly-report",
        "/reports",
        "/share/report/",
        "/settings",
        "/integrations",
        "/tokens",
        "/admin",
        "/clients",
        "/analyze",
        "/help",
        "/auth",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
