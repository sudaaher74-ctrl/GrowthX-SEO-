"use client";

import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-brand-950 border-t border-brand-900 text-brand-300 text-xs py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white">
                Growth<span className="text-series-6">X</span>
              </span>
              <span className="text-[10px] font-semibold text-brand-400 uppercase tracking-widest mt-0.5">
                AI SEO
              </span>
            </Link>
            <p className="text-sm font-semibold text-white">
              Find it. Fix it. Prove it.
            </p>
            <p className="text-brand-400 text-xs leading-relaxed max-w-sm">
              GrowthX crawls your website, tracks rivals and AI search, and ships the fixes.
              Built for Indian brands and agencies.
            </p>
            {/* Contact details */}
            <div className="space-y-2 pt-2 text-xs text-brand-400">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-series-400 shrink-0" />
                <a href="mailto:support@growthx.in" className="hover:text-white transition-colors">
                  support@growthx.in
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-series-400 shrink-0" />
                <a href="tel:+918767067884" className="hover:text-white transition-colors">
                  +91 8767067884
                </a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-series-400 shrink-0" />
                <span>New Panvel, Navi Mumbai, India</span>
              </div>
            </div>
          </div>

          {/* Product Column */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Product</p>
            <ul className="space-y-2">
              <li>
                <Link href="/website" className="hover:text-white transition-colors">
                  Website Audit
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Fix Engine
                </Link>
              </li>
              <li>
                <Link href="/competitor-intelligence" className="hover:text-white transition-colors">
                  Competitor Intelligence
                </Link>
              </li>
              <li>
                <Link href="/ai-visibility" className="hover:text-white transition-colors">
                  AI Visibility
                </Link>
              </li>
              <li>
                <Link href="/google-business-profile" className="hover:text-white transition-colors">
                  Google Business Profile
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Company</p>
            <ul className="space-y-2">
              <li>
                <Link href="/help" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <a href="mailto:support@growthx.in" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <Link href="/help" className="hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Legal</p>
            <ul className="space-y-2">
              <li>
                <Link href="/legal/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-white transition-colors">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-brand-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-brand-500">
          <p>© {new Date().getFullYear()} GrowthX AI SEO. All rights reserved.</p>
          <p>Find it. Fix it. Prove it.</p>
        </div>
      </div>
    </footer>
  );
}
