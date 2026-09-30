"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
        <PageHeader title="Google Performance" subtitle="Choose the source you want to look at." />
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

  return (
    <div className="space-y-4 pb-12">
      <PageHeader title="Google Performance" subtitle="Understand how Google visibility turns into traffic, engagement and business results." />
      <GoogleStatusBar projectId={projectId} source={source} />
      {group && (
        <nav aria-label="Google sections" className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          <Link href={group.href} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap text-primary-700 hover:bg-primary-50">
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
                  "shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors",
                  active ? "border-primary-600 bg-primary-600 text-white shadow-sm" : "border-line bg-white text-brand-600 hover:bg-primary-50 hover:text-primary-700",
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
