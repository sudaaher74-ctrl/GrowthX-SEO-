import Link from "next/link";

/**
 * Public shell for the policy pages.
 *
 * Deliberately outside `(dashboard)`: Google's OAuth reviewers, and anyone
 * deciding whether to connect an account, have to read these without signing
 * in. A policy behind a login is the same as no policy.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-sm font-bold tracking-tight text-slate-900">
            GrowthX AI SEO
          </Link>
          <nav className="flex gap-5 text-sm text-slate-500">
            <Link href="/legal/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-slate-900">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-slate-400">
          GrowthX AI SEO
        </div>
      </footer>
    </div>
  );
}
