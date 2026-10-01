"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/console";
import { GOOGLE_GROUPS, GOOGLE_VIEWS } from "@/components/google/nav";
import { GoogleStatusBar } from "@/components/google/status-bar";
import { useWorkspace } from "@/hooks/use-growthx";
import { cn } from "@/lib/utils";

const inside = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * The Google section's frame. It is two simple pages, Search Console and
 * Analytics 4, reached from the /google hub; every deeper view opens from one of
 * them and carries a way back plus its siblings. The 7d / 28d / 90d window
 * lives in the top bar and is shared by every view.
 */
export default function GoogleLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useWorkspace();
  const pathname = usePathname();

  if (pathname === "/google") {
    return (
      <div className="space-y-4 pb-12">
        {children}
      </div>
    );
  }

  if (pathname === "/google/search-console" || pathname === "/google/analytics") {
    const searchConsole = pathname === "/google/search-console";
    return (
      <div className="space-y-4 pb-12">
        <PageHeader
          title={searchConsole ? "Search Console" : "Analytics 4"}
          subtitle={searchConsole ? "How Google shows your site: clicks, impressions, position, and the queries and pages behind them." : "What visitors do on your site: sessions, users, engagement, channels and landing pages."}
          actions={
            <Link
              href="/google/report"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-sm hover:bg-signal-500 active:scale-95 transition-all"
            >
              <Sparkles size={13} />
              Improvement report
            </Link>
          }
        />
        <GoogleStatusBar projectId={projectId} source={searchConsole ? "searchConsole" : "analytics"} />
        {children}
      </div>
    );
  }

  const view = GOOGLE_VIEWS.find((v) => inside(pathname, v.href));
  const group = view ? GOOGLE_GROUPS[view.group] : null;
  const siblings = view ? GOOGLE_VIEWS.filter((v) => v.group === view.group) : [];
  const source = view?.group === "search-console" ? "searchConsole" : view?.group === "analytics" ? "analytics" : undefined;
  const pageTitle = view?.label ?? "Google Performance";
  const pageSubtitle = view?.will ?? "Understand how Google visibility turns into traffic, engagement and business results.";

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/google"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-950 transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Google Overview</span>
        </Link>
      </div>

      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <Link
            href="/google/report"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink shadow-sm hover:bg-signal-500 active:scale-95 transition-all"
          >
            <Sparkles size={13} />
            Improvement report
          </Link>
        }
      />
      <GoogleStatusBar projectId={projectId} source={source} />
      {group && (
        <nav
          aria-label="Google sections"
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-brand-50 border border-brand-200/60 p-1 text-[11.5px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link
            href={group.href}
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-brand-400 hover:text-brand-950 transition-colors"
          >
            <ArrowLeft size={12} />
            {group.label}
          </Link>
          {siblings.map((v) => {
            const active = inside(pathname, v.href);
            return (
              <Link
                key={v.id}
                href={v.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
                  active
                    ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "text-brand-400 hover:text-brand-950",
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
      )}
      {children}
    </div>
  );
}
