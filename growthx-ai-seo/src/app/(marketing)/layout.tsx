import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GrowthX — AI-Powered SEO & GEO Automation Platform",
  description:
    "GrowthX analyzes your website, competitors, and AI platforms, creates a prioritized 30-day plan, and automatically implements the improvements for you.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white antialiased">
      {children}
    </div>
  );
}
