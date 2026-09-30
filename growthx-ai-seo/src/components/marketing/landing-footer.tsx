"use client";

import Link from "next/link";

function OpenAiSpiralIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
      <path d="M22.28 9.87a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.06 6.06 0 0 0 4.96 4.18 5.98 5.98 0 0 0 2.2 8.78a6.05 6.05 0 0 0 1.07 7.07 5.98 5.98 0 0 0 .52 4.91 6.05 6.05 0 0 0 6.51 2.9 6.02 6.02 0 0 0 4.6 2.14 6.07 6.07 0 0 0 5.68-4.18 5.98 5.98 0 0 0 2.77-4.6 6.05 6.05 0 0 0-1.07-7.05zm-9.05 12.3a4.54 4.54 0 0 1-2.91-1.06l.14-.08 4.83-2.79a.77.77 0 0 0 .39-.67v-6.8l2.04 1.18a.07.07 0 0 1 .04.05v5.62a4.56 4.56 0 0 1-4.53 4.55zm-8.7-3.79a4.54 4.54 0 0 1-.54-3.05l.15.09 4.83 2.79a.77.77 0 0 0 .78 0l5.89-3.4v2.36a.07.07 0 0 1-.03.06l-4.87 2.81a4.56 4.56 0 0 1-6.21-1.66zm-1.8-9.4a4.54 4.54 0 0 1 2.37-2l-.01.16v5.58a.77.77 0 0 0 .39.67l5.89 3.4-2.04 1.18a.07.07 0 0 1-.07 0l-4.87-2.81a4.56 4.56 0 0 1-1.66-6.18zm13.1-2.73-4.83-2.79a.77.77 0 0 0-.78 0l-5.89 3.4v-2.36a.07.07 0 0 1 .03-.06l4.87-2.81a4.56 4.56 0 0 1 6.6 2.05v2.57zm5.55 6.32a4.54 4.54 0 0 1-2.37 2l.01-.16V6.83a.77.77 0 0 0-.39-.67l-5.89-3.4 2.04-1.18a.07.07 0 0 1 .07 0l4.87 2.81a4.56 4.56 0 0 1 1.66 6.18zm-8.83 2.2-2.6-1.5 2.6-1.5 2.6 1.5-2.6 1.5z" />
    </svg>
  );
}

function ClaudeSparkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
      <path d="M12 2l1.6 5.8L19.4 9.4l-5.8 1.6L12 16.8l-1.6-5.8L4.6 9.4l5.8-1.6L12 2zm6 12l.9 3.3L22.2 18.2l-3.3.9L18 22.4l-.9-3.3-3.3-.9 3.3-.9L18 14zm-12 0l.9 3.3L10.2 18.2l-3.3.9L6 22.4l-.9-3.3-3.3-.9 3.3-.9L6 14z" />
    </svg>
  );
}

function PerplexityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...props}>
      <path d="M12 2a1 1 0 0 1 1 1v4.06a7.02 7.02 0 0 1 2.93 1.21l2.87-2.87a1 1 0 1 1 1.41 1.41l-2.87 2.87A7.02 7.02 0 0 1 18.55 12.6H22a1 1 0 1 1 0 2h-3.45a7.02 7.02 0 0 1-1.21 2.93l2.87 2.87a1 1 0 0 1-1.41 1.41l-2.87-2.87A7.02 7.02 0 0 1 13 20.06V23a1 1 0 1 1-2 0v-2.94a7.02 7.02 0 0 1-2.93-1.21l-2.87 2.87a1 1 0 0 1-1.41-1.41l2.87-2.87A7.02 7.02 0 0 1 5.45 14.6H2a1 1 0 1 1 0-2h3.45a7.02 7.02 0 0 1 1.21-2.93L3.79 6.8a1 1 0 0 1 1.41-1.41l2.87 2.87A7.02 7.02 0 0 1 11 7.06V3a1 1 0 0 1 1-1zm0 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </svg>
  );
}

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
  subSection?: {
    title: string;
    links: { label: string; href: string }[];
  };
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Website Audit", href: "/register" },
      { label: "Competitor Intelligence", href: "/register" },
      { label: "AI Search Visibility", href: "/register" },
      { label: "Google Business Profile", href: "/register" },
      { label: "Fix Engine", href: "/register" },
    ],
    subSection: {
      title: "Connects to",
      links: [
        { label: "Google Search Console", href: "/register" },
        { label: "Google Analytics (GA4)", href: "/register" },
        { label: "Google Business Profile", href: "/register" },
        { label: "GitHub", href: "/register" },
      ],
    },
  },
  {
    title: "Company",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Help", href: "/help" },
      { label: "Log in", href: "/login" },
      { label: "Start free audit", href: "/register" },
    ],
  },
];

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-brand-950 text-brand-400 pt-16 sm:pt-20 pb-12 border-t border-brand-900 relative overflow-hidden">
      {/* Subtle decorative checkered grid on the far right (like Okara) */}
      <div className="absolute right-0 top-0 bottom-0 w-72 pointer-events-none opacity-[0.03] hidden xl:block">
        <div className="grid grid-cols-3 gap-2 h-full p-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-xl ${i % 2 === 0 ? "bg-white" : "bg-transparent"}`}
            />
          ))}
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
          {/* Brand Left Column */}
          <div className="lg:col-span-4 flex flex-col justify-between pr-0 lg:pr-8">
            <div>
              {/* Logo */}
              <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
                <div className="w-8 h-8 rounded-xl bg-series-6/20 border border-series-6/30 flex items-center justify-center text-series-6 font-black text-sm shadow-xs group-hover:bg-series-6/30 transition-colors">
                  G
                </div>
                <span className="text-2xl font-black text-white tracking-tight">
                  Growth<span className="text-series-6">X</span>
                </span>
              </Link>

              {/* Bold Headline Tagline */}
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight mb-2 max-w-sm">
                Find it. Fix it. Prove it.
              </h3>
              <p className="text-xs text-brand-400 mb-2 max-w-xs leading-relaxed">
                sudarshan@growthx.in &bull; +91 8767067884<br />
                New Panvel, Navi Mumbai, India
              </p>

            </div>

            {/* Request AI Summary of GrowthX */}
            <div className="pt-2">
              <p className="text-xs font-semibold text-brand-300 mb-2.5">
                Request AI summary of GrowthX
              </p>
              <div className="flex items-center gap-2.5">
                <a
                  href="https://chatgpt.com/?q=What+is+GrowthX+AI+SEO+and+how+does+it+work%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ask ChatGPT about GrowthX"
                  className="w-9 h-9 rounded-xl bg-brand-900/80 border border-brand-800 flex items-center justify-center text-brand-300 hover:text-white hover:border-brand-700 hover:bg-brand-850 transition-all cursor-pointer shadow-xs"
                >
                  <OpenAiSpiralIcon />
                </a>
                <a
                  href="https://claude.ai/new?q=What+is+GrowthX+AI+SEO+and+how+does+it+work%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ask Claude about GrowthX"
                  className="w-9 h-9 rounded-xl bg-brand-900/80 border border-brand-800 flex items-center justify-center text-brand-300 hover:text-white hover:border-brand-700 hover:bg-brand-850 transition-all cursor-pointer shadow-xs"
                >
                  <ClaudeSparkIcon />
                </a>
                <a
                  href="https://www.perplexity.ai/search?q=What+is+GrowthX+AI+SEO+platform%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ask Perplexity about GrowthX"
                  className="w-9 h-9 rounded-xl bg-brand-900/80 border border-brand-800 flex items-center justify-center text-brand-300 hover:text-white hover:border-brand-700 hover:bg-brand-850 transition-all cursor-pointer shadow-xs"
                >
                  <PerplexityIcon />
                </a>
              </div>
            </div>
          </div>

          {/* Categorized Columns */}
          <div className="lg:col-span-8 grid grid-cols-2 gap-8">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col">
                {/* Primary Section */}
                <div>
                  <h4 className="text-sm font-bold text-white mb-4 tracking-tight">
                    {col.title}
                  </h4>
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-xs text-brand-400 hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sub Section (if present) */}
                {col.subSection && (
                  <div className="mt-8">
                    <h4 className="text-sm font-bold text-white mb-4 tracking-tight">
                      {col.subSection.title}
                    </h4>
                    <ul className="space-y-2.5">
                      {col.subSection.links.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className="text-xs text-brand-400 hover:text-white transition-colors"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-brand-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-brand-500">
            &copy; {currentYear} GrowthX AI SEO. All rights reserved.
          </p>

          {/* Legal Links */}
          <div className="flex items-center gap-5 text-xs">
            <Link
              href="/legal/privacy"
              className="text-brand-500 hover:text-brand-300 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/terms"
              className="text-brand-500 hover:text-brand-300 transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
