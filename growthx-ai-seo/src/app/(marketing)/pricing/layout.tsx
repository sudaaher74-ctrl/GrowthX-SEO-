import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple INR and USD plans for founders, growing businesses, and SEO agencies. Start with a free audit — upgrade anytime.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing | Reigel",
    description:
      "Simple INR and USD plans for founders, growing businesses, and SEO agencies. Start with a free audit — upgrade anytime.",
    url: `${SITE_URL}/pricing`,
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
