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
      { label: "Website Audit", href: "/#features" },
      { label: "Competitor Intelligence", href: "/#features" },
      { label: "AI Search Visibility", href: "/#features" },
      { label: "Google Business Profile", href: "/#features" },
      { label: "Fix Engine", href: "/#features" },
    ],
    subSection: {
      title: "Connects to",
      links: [
        { label: "Google Search Console", href: "/#how-it-works" },
        { label: "Google Analytics (GA4)", href: "/#how-it-works" },
        { label: "Google Business Profile", href: "/#how-it-works" },
        { label: "GitHub", href: "/#how-it-works" },
      ],
    },
  },
  {
    title: "Company",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Help", href: "/help" },
      { label: "Log in", href: "/login" },
      { label: "Start free audit", href: "/login" },
    ],
  },
];

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface-1 text-brand-500 pt-12 sm:pt-20 pb-10 sm:pb-12 border-t border-brand-200 relative overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 mb-12 sm:mb-16">
          {/* Brand Left Column */}
          <div className="lg:col-span-4 flex flex-col justify-between pr-0 lg:pr-8">
            <div>
              {/* Logo — Matches Dashboard Brand Identity */}
              <Link href="/" className="inline-flex items-center gap-2.5 mb-5 sm:mb-6 group">
                <div className="w-8 h-8 rounded-xl bg-signal-400 flex items-center justify-center text-signal-ink font-mono font-extrabold text-sm shadow-xs">
                  R
                </div>
                <span className="text-xl sm:text-2xl font-black text-brand-950 tracking-tight">
                  Reigel
                </span>
                <span className="rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-brand-500">
                  AI SEO
                </span>
              </Link>

              {/* Bold Headline Tagline */}
              <h3 className="text-xl sm:text-3xl font-black text-brand-950 leading-tight tracking-tight mb-2 max-w-sm">
                Find it. Fix it. Prove it.
              </h3>
              <p className="text-xs text-brand-500 mb-2 max-w-xs leading-relaxed">
                sudarshan@growthx.in &bull; +91 8767067884<br />
                New Panvel, Navi Mumbai, India
              </p>
            </div>

            {/* Request AI Summary of Reigel */}
            <div className="pt-2">
              <p className="text-xs font-semibold text-brand-700 mb-2.5">
                Request AI summary of Reigel
              </p>
              <div className="flex items-center gap-2.5">
                <a
                  href="https://chatgpt.com/?q=What+is+Reigel+AI+SEO+and+how+does+it+work%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ask ChatGPT about Reigel"
                  className="w-9 h-9 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center text-brand-700 hover:text-brand-950 hover:border-brand-300 transition-all cursor-pointer shadow-2xs"
                >
                  <OpenAiSpiralIcon />
                </a>
                <a
                  href="https://claude.ai/new?q=What+is+Reigel+AI+SEO+and+how+does+it+work%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ask Claude about Reigel"
                  className="w-9 h-9 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center text-brand-700 hover:text-brand-950 hover:border-brand-300 transition-all cursor-pointer shadow-2xs"
                >
                  <ClaudeSparkIcon />
                </a>
                <a
                  href="https://www.perplexity.ai/search?q=What+is+Reigel+AI+SEO+platform%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ask Perplexity about Reigel"
                  className="w-9 h-9 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center text-brand-700 hover:text-brand-950 hover:border-brand-300 transition-all cursor-pointer shadow-2xs"
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
                <div>
                  <h4 className="text-sm font-bold text-brand-950 mb-4 tracking-tight">
                    {col.title}
                  </h4>
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-xs text-brand-500 hover:text-brand-950 transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {col.subSection && (
                  <div className="mt-8">
                    <h4 className="text-sm font-bold text-brand-950 mb-4 tracking-tight">
                      {col.subSection.title}
                    </h4>
                    <ul className="space-y-2.5">
                      {col.subSection.links.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className="text-xs text-brand-500 hover:text-brand-950 transition-colors"
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
        <div className="border-t border-brand-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-brand-500">
            &copy; {currentYear} Reigel AI SEO. All rights reserved.
          </p>

          <div className="flex items-center gap-5 text-xs">
            <Link
              href="/legal/privacy"
              className="text-brand-500 hover:text-brand-950 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/terms"
              className="text-brand-500 hover:text-brand-950 transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/security"
              className="text-brand-500 hover:text-brand-950 transition-colors"
            >
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
