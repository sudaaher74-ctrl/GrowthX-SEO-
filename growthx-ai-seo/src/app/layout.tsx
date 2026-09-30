import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GrowthX: find what's costing you customers, then fix it",
    template: "%s | GrowthX",
  },
  description: SITE_DESCRIPTION,
  keywords: ["SEO audit", "AI search visibility", "competitor tracking", "Google Business Profile", "SEO for agencies", "GrowthX"],
  authors: [{ name: "GrowthX" }],
  creator: "GrowthX",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "GrowthX",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        No Google Fonts <link> here. Inter is already self-hosted by
        `next/font/google` above — `inter.className` defines the `Inter`
        family from files this app serves — so the stylesheet that used to sit
        here fetched the same font a second time while blocking first render on
        a third party. Removing it took first paint on a cold, fonts-unreachable
        connection from ~13s to well under a second, with identical rendering.
      */}
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
