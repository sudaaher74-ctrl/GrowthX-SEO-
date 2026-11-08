import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

const GA_MEASUREMENT_ID = "G-0ZZF8NS1YV";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Reigel: find what's costing you customers, then fix it",
    template: "%s | Reigel",
  },
  description: SITE_DESCRIPTION,
  keywords: ["SEO audit", "AI search visibility", "competitor tracking", "Google Business Profile", "SEO for agencies", "Reigel"],
  authors: [{ name: "Reigel" }],
  creator: "Reigel",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "Reigel",
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
      <head>
        <script
          id="growthx-theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("growthx_theme")||"dark";if(t==="dark"){document.documentElement.classList.add("dark","dash-dark");document.documentElement.classList.remove("light","dash-light");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark","dash-dark");document.documentElement.classList.add("light","dash-light");document.documentElement.style.colorScheme="light";}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={inter.className}>
        {/* Google Analytics (gtag.js), loaded after the page is interactive. */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
