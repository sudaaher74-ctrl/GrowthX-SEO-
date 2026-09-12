"use client";

import Link from "next/link";

const NAV_LINKS = {
  Product: ["Website Audit", "Competitor Intel", "AI Visibility", "Fix Engine"],
  Solutions: ["Agencies", "E-Commerce", "SaaS Companies"],
  Resources: ["Documentation", "Case Studies", "Blog"],
};

export function LandingFooter() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 mb-1.5">
              <span className="text-lg font-extrabold text-white tracking-tight">
                Growth<span className="text-violet-400">X</span>
              </span>
            </Link>
            <p className="text-xs text-slate-400 max-w-sm">
              AI-powered SEO &amp; GEO automation platform. Real-time website analysis, competitive intelligence, and autonomous fix implementation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-8 text-xs font-medium">
            {Object.entries(NAV_LINKS).map(([section, links]) => (
              <div key={section} className="flex items-center gap-4">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  {section}:
                </span>
                {links.map((link) => (
                  <span key={link} className="text-slate-400 hover:text-slate-200 transition-colors">
                    {link}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} GrowthX AI SEO. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal/terms" className="hover:text-slate-400 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
