"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight, Sun, Moon } from "lucide-react";
import { auth, subscribeToAuthChange } from "@/lib/api-client";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Who it's for", href: "/#who-its-for" },
  { label: "FAQ", href: "/#faq" },
];

export function LandingHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  const signedIn = useSyncExternalStore(
    subscribeToAuthChange,
    () => auth.isAuthenticated(),
    () => false,
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isPricing = pathname === "/pricing";

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-200 border-b",
        scrolled || isPricing
          ? "bg-surface-1/90 backdrop-blur-md border-brand-200 shadow-xs"
          : "bg-surface-1/75 backdrop-blur-md border-brand-200/70",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo — Matches Dashboard Sidebar Brand Identity */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-signal-400 font-mono text-xs font-extrabold text-signal-ink shadow-xs">
              R
            </span>
            <span className="text-[17px] font-extrabold tracking-tight text-brand-950">
              Reigel
            </span>
            <span className="hidden sm:inline-block rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-brand-500">
              AI SEO
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-3 py-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-950 rounded-full hover:bg-surface-2 transition-colors"
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/pricing"
              className={cn(
                "px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors",
                isPricing
                  ? "bg-surface-2 text-brand-950 font-semibold border border-brand-200"
                  : "text-brand-600 hover:text-brand-950 hover:bg-surface-2",
              )}
            >
              Pricing
            </Link>
          </nav>

          {/* Right Controls: Day/Night Switcher + Auth CTAs */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Theme Toggle (Desktop only here, mobile has it inside mobile menu) */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to Day mode" : "Switch to Night mode"}
              title={isDark ? "Switch to Day mode" : "Switch to Night mode"}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 bg-surface-2 text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-950 cursor-pointer"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {signedIn ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 bg-signal-400 hover:bg-signal-500 text-signal-ink text-xs sm:text-[13px] font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all shadow-xs cursor-pointer"
              >
                <span><span className="hidden sm:inline">Go to </span>Dashboard</span>
                <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-brand-200 bg-surface-2 hover:bg-brand-100 text-brand-950 text-xs sm:text-[13px] font-semibold px-3 sm:px-4 py-1.5 sm:py-2 transition-all cursor-pointer"
                >
                  Log in
                </Link>
                <Link
                  href="/login"
                  className="hidden sm:flex items-center gap-1.5 bg-signal-400 hover:bg-signal-500 text-signal-ink text-[13px] font-bold px-4 py-2 rounded-full transition-all shadow-xs cursor-pointer"
                >
                  <span>Start free audit</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-1.5 rounded-lg text-brand-700 hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-surface-1 border-t border-brand-200 px-4 pb-4 pt-2 space-y-1 shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-brand-200 mb-1">
            <span className="text-xs font-semibold text-brand-500">Appearance</span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to Day mode" : "Switch to Night mode"}
              title={isDark ? "Switch to Day mode" : "Switch to Night mode"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-200 bg-surface-2 text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-950"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>

          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-brand-700 hover:text-brand-950 hover:bg-surface-2 rounded-lg transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
              isPricing
                ? "text-brand-950 font-bold bg-surface-2"
                : "text-brand-700 hover:bg-surface-2 hover:text-brand-950",
            )}
          >
            Pricing
          </Link>
          <div className="border-t border-brand-200 pt-3 mt-2 space-y-2">
            {!signedIn && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded-full border border-brand-200 bg-surface-2 px-4 py-2.5 text-sm font-semibold text-brand-950 hover:bg-brand-100 transition-colors"
              >
                Log in
              </Link>
            )}
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 bg-signal-400 hover:bg-signal-500 text-signal-ink text-sm font-bold px-4 py-3 rounded-full"
            >
              {signedIn ? "Go to Dashboard" : "Start free audit"} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
