"use client";

import Link from "next/link";

const NAV_LINKS = {
  Product: ["Website Audit", "Competitor Intelligence", "AI Visibility", "Fix Engine", "Reports"],
  Solutions: ["Agencies", "E-Commerce", "Local Businesses", "SaaS Companies"],
  Resources: ["Documentation", "Blog", "Case Studies", "API Reference"],
  Company: ["About", "Pricing", "Contact", "Careers"],
};

export function LandingFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-1.5 mb-3">
              <span className="text-xl font-extrabold text-white tracking-tight">
                Growth<span className="text-violet-400">X</span>
              </span>
            </Link>
            <p className="text-[13px] text-slate-400 leading-relaxed mb-4 max-w-xs">
              AI-powered SEO &amp; GEO automation. Analyze. Plan. Execute. Grow.
            </p>
            <Link
              href="/analyze"
              className="inline-flex items-center text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
            >
              Start free analysis →
            </Link>
          </div>

          {/* Nav columns */}
          {Object.entries(NAV_LINKS).map(([section, links]) => (
            <div key={section}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                {section}
              </p>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-[13px] text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-slate-600">
            © {new Date().getFullYear()} GrowthX. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service"].map((item) => (
              <Link
                key={item}
                href="#"
                className="text-[12px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
