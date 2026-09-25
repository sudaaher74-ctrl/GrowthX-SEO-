import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GrowthX – AI SEO & Google Business Profile Automation",
  description:
    "Audit your site, track rivals and AI search, and let GrowthX ship the fixes. Built for Indian brands and agencies. Free audit, plans from ₹2,999/month.",
  openGraph: {
    title: "Find it. Fix it. Prove it. — GrowthX",
    description:
      "Audit your site, track rivals and AI search, and let GrowthX ship the fixes. Built for Indian brands and agencies.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-950 text-brand-50 antialiased selection:bg-series-6 selection:text-white">
      {children}
    </div>
  );
}
