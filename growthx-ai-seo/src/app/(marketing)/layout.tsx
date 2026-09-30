import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, url: SITE_URL },
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
