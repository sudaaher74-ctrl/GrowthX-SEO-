"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { routeFor } from "@/lib/routes";
import { TopNav } from "@/components/layout/topnav";
import { auth } from "@/lib/api-client";

/** The token lives in localStorage and only changes on sign-in or sign-out,
 *  both of which navigate — so there is nothing to subscribe to. */
const noSubscribe = () => () => {};

/**
 * Every dashboard route renders inside this shell, so it is where the session
 * check belongs.
 *
 * It used to sign the visitor in as a fixed demo account — email and password
 * literals in a client component, which ships them in the bundle to anyone who
 * opens the page. Whoever held them held that account's data, and the app had
 * no other way in, so there was effectively no authentication at all. An
 * unauthenticated visitor now goes to /login like any other product.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // localStorage is unreadable during the server render. useSyncExternalStore
  // is the pattern already used for the stored org in `useWorkspace`: a client
  // snapshot and a separate server one, so there is no hydration mismatch and
  // no state update inside an effect. `null` means "not known yet".
  const signedIn = useSyncExternalStore(
    noSubscribe,
    () => auth.isAuthenticated(),
    () => null,
  );

  useEffect(() => {
    if (signedIn === false) router.replace("/login");
  }, [signedIn, router]);

  // Render nothing until the answer is known, rather than a frame of dashboard
  // chrome that a signed-out visitor should never see.
  if (signedIn !== true) return null;

  const route = routeFor(pathname);

  return (
    <div className="min-h-screen" style={{ background: "var(--color-brand-50)" }}>
      {/* Every one of the 40 dashboard routes shared the root layout's single
          title, so every browser tab and every bookmark read "GrowthX AI SEO —
          AI SEO Automation Platform". These pages are all Client Components, so
          they cannot export `metadata`; React hoists this <title> to <head>
          instead, and it is written here so a page gets its name by being in
          the route registry rather than by remembering to declare one. The
          suffix is spelled out because a hoisted title replaces the root
          layout's template rather than filling it in. */}
      <title>{route ? `${route.label} | GrowthX AI SEO` : "GrowthX AI SEO"}</title>
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <TopNav setMobileOpen={setMobileOpen} />
      {/* 232px sidebar + 52px header, per the design's measurements. */}
      <main className="min-h-screen pt-[52px] md:ml-[232px]">
        <div className="mx-auto max-w-[1600px] p-5 md:p-6">{children}</div>
      </main>
    </div>
  );
}
