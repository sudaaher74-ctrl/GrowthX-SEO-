import Link from "next/link";

const sections = [
  {
    title: "Search Console",
    description: "Clicks, impressions, ranking position, queries, and pages from Google Search Console.",
    href: "/google/search-console",
    source: "GSC",
  },
  {
    title: "Google Analytics 4",
    description: "Sessions, users, engagement, conversions, channels, and landing pages from GA4.",
    href: "/google/analytics",
    source: "GA4",
  },
  {
    title: "Keywords",
    description: "Find the search terms that bring traffic and the terms that need improvement.",
    href: "/google/keywords",
    source: "GSC",
  },
  {
    title: "Pages",
    description: "See which pages are gaining or losing search visibility.",
    href: "/google/pages",
    source: "GSC",
  },
  {
    title: "Index Status",
    description: "Check which crawled pages are indexed, not indexed, or still not inspected.",
    href: "/google/index",
    source: "GSC",
  },
  {
    title: "Growth Opportunities",
    description: "Review the highest-impact actions detected from Google and crawl data.",
    href: "/google/opportunities",
    source: "Reigel",
  },
  {
    title: "Traffic",
    description: "Understand where visitors come from and which pages they land on.",
    href: "/google/traffic",
    source: "GA4",
  },
  {
    title: "Improvement Report",
    description: "Track recommended improvements and the expected impact of each fix.",
    href: "/google/improvement-report",
    source: "Reigel",
  },
];

export default function GoogleHubPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-200/60 bg-brand-50/70 p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-signal-500">Google workspace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-950">Google performance center</h1>
            <p className="mt-2 text-sm text-brand-500">
              Open Search Console, Analytics 4, keywords, pages, index status, traffic, and opportunities from one place.
            </p>
          </div>
          <Link
            href="/integrations"
            className="inline-flex items-center justify-center rounded-full bg-signal-400 px-4 py-2 text-sm font-bold text-signal-ink shadow-xs transition hover:bg-signal-300"
          >
            Manage Google connections
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-2xl border border-brand-200/60 bg-brand-50/60 p-5 shadow-card transition hover:-translate-y-0.5 hover:border-signal-300 hover:bg-brand-50"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-brand-950 group-hover:text-signal-500">{section.title}</h2>
              <span className="rounded-full bg-brand-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-500">
                {section.source}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-brand-500">{section.description}</p>
            <span className="mt-5 inline-flex text-sm font-bold text-signal-600 group-hover:underline">Open page →</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
