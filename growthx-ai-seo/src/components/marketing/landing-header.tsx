"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, ArrowRight } from "lucide-react";

export function LandingHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isPricing = pathname === "/pricing";

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled || isPricing
          ? "bg-white/95 backdrop-blur-md shadow-[0_1px_0_0_#e5e7eb]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Growth<span className="text-violet-600">X</span>
            </span>
            <span className="hidden sm:block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
              AI SEO
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {["Product", "Solutions", "Resources"].map((item) => (
              <button
                key={item}
                className="flex items-center gap-0.5 px-3 py-2 text-[13.5px] font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {item}
                <ChevronDown size={13} className="text-slate-400 mt-0.5" />
              </button>
            ))}

            <Link
              href="/pricing"
              className={`px-3 py-1.5 text-[13.5px] font-medium transition-colors ${
                isPricing
                  ? "text-violet-700 font-semibold border-b-2 border-violet-600"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
              }`}
            >
              Pricing
            </Link>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden md:block text-[13.5px] font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              Log in
            </Link>
            <Link
              href="/analyze"
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-[13.5px] font-semibold px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-violet-200 hover:shadow-md"
            >
              Analyze Your Website
              <ArrowRight size={14} />
            </Link>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 pb-4 pt-2 space-y-1 shadow-lg">
          {["Product", "Solutions", "Resources"].map((item) => (
            <button
              key={item}
              className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {item}
            </button>
          ))}
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className={`block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              isPricing ? "text-violet-700 font-bold bg-violet-50" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Pricing
          </Link>
          <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
            <Link
              href="/login"
              className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/analyze"
              className="flex items-center justify-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-3 rounded-xl"
            >
              Analyze Your Website <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
