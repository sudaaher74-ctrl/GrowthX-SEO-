"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/console";
import { GOOGLE_VIEWS } from "@/components/google/nav";
import { GoogleStatusBar } from "@/components/google/status-bar";
import { useWorkspace } from "@/hooks/use-growthx";
import { cn } from "@/lib/utils";

/**
 * The Google section's frame: title, connection and freshness, and the
 * sub-navigation. The 7d / 28d / 90d window lives in the top bar and is shared
 * by every view, so it holds as you move between them.
 */
export default function GoogleLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useWorkspace();
  const pathname = usePathname();

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Google Performance"
        subtitle="Understand how Google visibility turns into traffic, engagement and business results."
      />
      <GoogleStatusBar projectId={projectId} />
      <nav aria-label="Google sections" className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {GOOGLE_VIEWS.map((view) => {
          const active = view.href === "/google" ? pathname === "/google" : pathname === view.href || pathname.startsWith(`${view.href}/`);
          return (
            <Link
              key={view.id}
              href={view.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors",
                active
                  ? "border-primary-600 bg-primary-600 text-white shadow-sm"
                  : "border-line bg-white text-brand-600 hover:bg-primary-50 hover:text-primary-700",
                !view.built && !active && "text-brand-400",
              )}
            >
              {view.label}
              {!view.built && (
                <span className={cn("rounded-full px-[5px] py-px font-mono text-[9.5px] font-semibold", active ? "bg-white/15 text-white" : "bg-brand-100 text-brand-500")}>
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
