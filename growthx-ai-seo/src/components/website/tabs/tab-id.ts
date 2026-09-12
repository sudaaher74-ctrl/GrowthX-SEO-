/**
 * The tabs of the Website Audit screen.
 *
 * Shared so the page and the tab components agree on the set. The tab
 * components take a callback that switches tabs; typing it as a plain `string`
 * forced the page to cast its own `setActiveTab` through `any` to hand it over,
 * which turned a typo in a tab name into a silent no-op.
 */
export type WebsiteTabId =
  | "overview"
  | "technical-seo"
  | "performance"
  | "pages"
  | "content"
  | "geo"
  | "issues";
