/** Landing page FAQ. Read by the FAQ section and by the FAQPage structured data. */
export const FAQS = [
  {
    q: "Will it change my site without asking?",
    a: "Never. On GitHub, fixes arrive as pull requests with a before/after diff and Reigel never merges for you. On WordPress, Shopify, and Webflow, you approve every single fix or batch as Draft or Live — and Reigel saves an automatic BEFORE snapshot with 1-Click Safe Rollback.",
  },
  {
    q: "Does it work with WordPress, Shopify, and Webflow — or only GitHub?",
    a: "All four. You can publish individual fixes, safe batches (up to 15 fixes at once), and Grounded Content Studio articles directly to WordPress, Shopify, Webflow, or as GitHub pull requests. On custom stacks you can also export clean Markdown, HTML, or code diffs.",
  },
  {
    q: "Do I need a developer?",
    a: "Not for WordPress, Shopify, or Webflow — connect once and publish approved fixes or drafts directly with automatic rollback protection. For custom codebases on GitHub, a developer reviews and merges the pull requests Reigel opens.",
  },
  {
    q: "How is this different from Semrush or Ahrefs?",
    a: "They stop at charts and spreadsheets. Reigel runs the full 5-stage pipeline on demand or on schedule, turns gaps into grounded content and ready-to-publish fixes, verifies every change with a re-crawl, and guards against regressions automatically.",
  },
  {
    q: "Which AI assistants do you measure?",
    a: "ChatGPT, Claude, Gemini, Perplexity, and Sarvam, each queried through its own official API — alongside an interactive SERP Visualizer showing real citation links and crawled snippet previews. Where an assistant has no public API, we say so honestly instead of showing a fake zero.",
  },
  {
    q: "What happens if a fix breaks something or comes back later?",
    a: "Every direct CMS publish captures a BEFORE snapshot so you can revert in one click. After deployment, Reigel's Regression Guard re-crawls on schedule, automatically re-opens any defect that returns, and alerts your team via HMAC-signed Slack, Discord, or REST webhooks.",
  },
  {
    q: "Can agencies use it for clients?",
    a: "Yes. The Agency plan manages up to 20 websites in one Agency Hub with 1-click per-client pipelines, frozen historical monthly snapshots, zero-login white-label client portal links, bulk Lock & Share All Clients, and server-rendered A4 PDF & CSV exports.",
  },
  {
    q: "Does the Content Studio invent statistics or facts?",
    a: "Never. Grounded SEO Content Studio turns your keyword gaps, declining pages, rival moves, and AI visibility gaps into articles, briefs, FAQs, and JSON-LD grounded strictly in your crawled site facts — ready to publish to WordPress, Shopify, Webflow, or GitHub.",
  },
  {
    q: "What does the free audit include?",
    a: "A free account and a headless crawl of your website with a ranked fix queue. No card is needed. Paid plans add scheduled full pipelines, rival & backlink recovery tracking, AI visibility cycles, batch CMS/GitHub fixes, Content Studio, and white-label client portals.",
  },
  {
    q: "How long until I see results, and is my data safe?",
    a: "Technical fixes verify on the next crawl (minutes to days), while rankings and AI citations move over weeks — we track both separately in the Fix Impact Ledger. Credentials and CMS tokens are encrypted, workspaces are isolated, and outgoing webhooks are HMAC-SHA256 signed.",
  },
];
