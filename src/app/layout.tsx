import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GrowthX AI SEO — AI SEO Automation Platform",
    template: "%s | GrowthX AI SEO",
  },
  description:
    "The world's most advanced AI-powered SEO automation platform. Automate technical SEO, generate optimized content, track rankings, and dominate search — for agencies, e-commerce, and local businesses.",
  keywords: ["SEO", "AI SEO", "SEO automation", "rank tracking", "content AI", "local SEO", "GrowthX"],
  authors: [{ name: "GrowthX" }],
  creator: "GrowthX",
  metadataBase: new URL("https://growthx.in"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://growthx.in",
    title: "GrowthX AI SEO — AI SEO Automation Platform",
    description: "AI-powered SEO automation for agencies, local businesses & e-commerce brands.",
    siteName: "GrowthX AI SEO",
  },
  twitter: {
    card: "summary_large_image",
    title: "GrowthX AI SEO",
    description: "AI-powered SEO automation platform.",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
