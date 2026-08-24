import type { Metadata } from "next";

/**
 * Title only.
 *
 * The page itself is a Client Component and so cannot export `metadata`, and
 * neither a React <title> element nor a `document.title` write survives — Next
 * owns the document title and overwrites both. A server layout is the one place
 * the title can be declared, which is all this file is for. `%s | GrowthX AI
 * SEO` comes from the root layout's template.
 */
export const metadata: Metadata = { title: "Collaboration Outreach" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
