import type { Metadata } from "next";

/**
 * Title only — see any sibling route's layout for why this lives in a server
 * layout rather than in the page.
 *
 * This one is spelled out as `default` + `template` because the route has
 * children. A plain string title here would satisfy this segment but stop the
 * root layout's template reaching the sub-pages, and they would render as a
 * bare "Content Gap Analysis" with no product name after it.
 */
export const metadata: Metadata = {
  title: { default: "Content Intelligence", template: "%s | GrowthX AI SEO" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
