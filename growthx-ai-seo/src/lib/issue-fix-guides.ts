export type GuidePlatform =
  | "wordpress"
  | "shopify"
  | "webflow"
  | "wix"
  | "developer";

export const GUIDE_PLATFORMS: { id: GuidePlatform; label: string }[] = [
  { id: "wordpress", label: "WordPress" },
  { id: "shopify", label: "Shopify" },
  { id: "webflow", label: "Webflow" },
  { id: "wix", label: "Wix / Squarespace" },
  { id: "developer", label: "Developer / Code" },
];

export type FixDifficulty = "no_code" | "cms_or_dev" | "developer";

export interface IssueFixGuide {
  /** Plain-English explanation of what is actually wrong */
  whatIsWrong: string;
  /** Why this matters to customers, clicks, and revenue */
  whyItMatters: string;
  /** Plain-English who-can-do-this classification */
  difficulty: FixDifficulty;
  difficultyLabel: string;
  estimatedTime: string;
  /** Tailored step-by-step instructions for every common platform */
  platformSteps: Record<GuidePlatform, string[]>;
  /** Optional ready-to-copy snippet or example */
  exampleLabel?: string;
  exampleCode?: string;
  /** Plain-English checklist to confirm the fix worked */
  verifySteps: string[];
  /** Ready-to-send handoff message for WhatsApp, Slack, or Email */
  developerHandoff: string;
}

export interface IssueGuideInput {
  title: string;
  issueType?: string | null;
  summary?: string | null;
  recommendedAction?: string | null;
  domain?: string | null;
  affectedPages?: string[];
  fixClass?: string | null;
  source?: string | null;
}

function cleanOrigin(domain?: string | null): string {
  const host = (domain || "yourwebsite.com")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  return `https://${host}`;
}

function buildHandoffText(
  title: string,
  whatIsWrong: string,
  whyItMatters: string,
  devSteps: string[],
  affectedPages: string[],
  recommendedAction?: string | null,
  exampleCode?: string,
): string {
  const lines: string[] = [
    `Hi! Could you please help fix this issue on our website?`,
    ``,
    `Issue: ${title}`,
    `What's wrong: ${whatIsWrong}`,
    `Why it matters: ${whyItMatters}`,
  ];

  if (affectedPages.length > 0) {
    lines.push(``, `Affected pages (${affectedPages.length}):`);
    for (const url of affectedPages.slice(0, 6)) {
      lines.push(`- ${url}`);
    }
    if (affectedPages.length > 6) {
      lines.push(`- ...and ${affectedPages.length - 6} more`);
    }
  }

  if (recommendedAction?.trim()) {
    lines.push(``, `Specific recommendation:`, recommendedAction.trim());
  }

  lines.push(``, `Steps to fix:`);
  devSteps.forEach((step, idx) => {
    lines.push(`${idx + 1}. ${step}`);
  });

  if (exampleCode) {
    lines.push(``, `Reference example:`, exampleCode);
  }

  lines.push(``, `Once updated, please let me know so I can verify it live.`);
  return lines.join("\n");
}

/**
 * Translates any SEO audit finding, search opportunity, or technical defect
 * into a complete, jargon-free explanation and platform-by-platform solution
 * so non-technical website owners never feel stuck or confused.
 */
export function getIssueFixGuide(input: IssueGuideInput): IssueFixGuide {
  const origin = cleanOrigin(input.domain);
  const pages = (input.affectedPages ?? []).filter(Boolean);
  const firstUrl = pages[0] || `${origin}/`;
  const key = `${input.issueType ?? ""} ${input.title} ${input.summary ?? ""} ${input.source ?? ""}`.toUpperCase();

  const finalize = (spec: {
    whatIsWrong: string;
    whyItMatters: string;
    difficulty: FixDifficulty;
    estimatedTime: string;
    platformSteps: Record<GuidePlatform, string[]>;
    exampleLabel?: string;
    exampleCode?: string;
    verifySteps: string[];
  }): IssueFixGuide => {
    const difficultyLabel =
      spec.difficulty === "no_code"
        ? "No coding needed"
        : spec.difficulty === "cms_or_dev"
          ? "Easy in CMS or with developer"
          : "Best sent to developer";

    return {
      ...spec,
      difficultyLabel,
      developerHandoff: buildHandoffText(
        input.title,
        spec.whatIsWrong,
        spec.whyItMatters,
        spec.platformSteps.developer,
        pages,
        input.recommendedAction,
        spec.exampleCode,
      ),
    };
  };

  if (key.includes("CANONICAL") || key.includes("REAL ONE") || key.includes("MAIN VERSION")) {
    return finalize({
      whatIsWrong:
        "The same page can be opened using more than one web address (for example with or without 'www', or with tracking tags), and the page doesn't clearly tell Google which address is the official one.",
      whyItMatters:
        "When Google sees duplicate versions of your page, it splits your ranking strength across them — making it harder for your main page to reach the top of search results.",
      difficulty: "cms_or_dev",
      estimatedTime: "10–15 mins",
      platformSteps: {
        wordpress: [
          "Open the affected page in WordPress and scroll down to Yoast SEO or Rank Math.",
          "Click the 'Advanced' tab inside the SEO box.",
          `Paste the clean main address (e.g. ${firstUrl}) into the 'Canonical URL' field and click Update.`,
        ],
        shopify: [
          "Shopify sets canonical URLs automatically on standard pages, so check if a custom theme edit or app removed it.",
          "Go to Online Store → Themes → Edit code → layout/theme.liquid.",
          "Confirm <link rel=\"canonical\" href=\"{{ canonical_url }}\"> exists inside the <head> section and Save.",
        ],
        webflow: [
          "Open Site Settings → SEO tab in Webflow.",
          `Enter your official domain (${origin}) in the 'Global Canonical Tag URL' field.`,
          "Save changes and publish your site to apply clean canonical tags across every page.",
        ],
        wix: [
          "In Wix, go to Marketing & SEO → SEO → SEO Settings → choose the page type.",
          "Open Additional Meta Tags and confirm the Canonical tag points to the clean page URL.",
          "In Squarespace, canonical tags are automatic — check Settings → Domains to ensure one primary domain is selected.",
        ],
        developer: [
          `Add a single self-referencing <link rel="canonical" href="${firstUrl}" /> inside <head> on each affected page.`,
          "Strip tracking query parameters (?utm_*, ?ref, ?fbclid) from generated canonical URLs.",
          "Ensure the canonical URL returns HTTP 200 OK and is not blocked by robots.txt or noindex.",
        ],
      },
      exampleLabel: "HTML tag your developer adds inside <head>",
      exampleCode: `<link rel="canonical" href="${firstUrl}" />`,
      verifySteps: [
        "Open the page in Chrome, right-click → View Page Source, and search for 'canonical'.",
        "Confirm it matches the exact main HTTPS URL with no extra parameters, then click Verify Live below.",
      ],
    });
  }

  if (key.includes("NOINDEX") || key.includes("NOT TO SHOW") || key.includes("BLOCKING GOOGLE") || key.includes("ROBOTS")) {
    return finalize({
      whatIsWrong:
        "One or more pages currently have an invisible 'Do Not Show in Google' instruction (called noindex or a robots.txt block), preventing search engines from listing them.",
      whyItMatters:
        "Even if the page looks great to visitors, customers searching on Google will never be able to discover it until this hidden block is removed.",
      difficulty: "cms_or_dev",
      estimatedTime: "5–10 mins",
      platformSteps: {
        wordpress: [
          "Check Settings → Reading and make sure 'Discourage search engines from indexing this site' is UNCHECKED.",
          "Open each listed page → scroll to Yoast SEO / Rank Math → Advanced tab.",
          "Set 'Allow search engines to show this page in search results?' to YES, then click Update.",
        ],
        shopify: [
          "Open Online Store → Themes → Edit code and check layout/theme.liquid for any 'noindex' tag.",
          "If using a Shopify SEO app, open that page inside the app and turn 'Hide from search engines' OFF.",
          "Confirm your store password page is disabled under Online Store → Preferences.",
        ],
        webflow: [
          "Open Site Settings → SEO → Indexing and ensure 'Disable Webflow subdomain indexing' only affects staging.",
          "Check the Robots.txt box to make sure these live paths are not listed under Disallow.",
          "Open the individual Page Settings and check Custom Code for any stray noindex tag, then Publish.",
        ],
        wix: [
          "Open Pages & Menu → click the three dots next to the affected page → SEO Basics.",
          "Turn ON 'Let search engines index this page'.",
          "In Squarespace, open Page Settings → SEO and toggle OFF 'Hide page from search results'.",
        ],
        developer: [
          "Confirm whether each listed URL should be public on Google (keep admin/checkout/thank-you pages hidden).",
          "Remove any <meta name=\"robots\" content=\"noindex\"> tag or X-Robots-Tag: noindex HTTP header on public pages.",
          "Inspect /robots.txt and remove any Disallow rule blocking public routes.",
        ],
      },
      exampleLabel: "Correct indexable tag inside <head>",
      exampleCode: `<meta name="robots" content="index, follow" />`,
      verifySteps: [
        "Open the affected page and verify no 'noindex' tag appears in the source code.",
        "Click 'I Fixed It — Check Live Site' below to confirm Google is allowed to index the page.",
      ],
    });
  }

  if (key.includes("TITLE") || key.includes("SAME NAME IN SEARCH")) {
    return finalize({
      whatIsWrong:
        "The page title (the blue clickable headline shown on Google) is missing, too short, too long, or duplicated across multiple pages.",
      whyItMatters:
        "Your page title is the very first thing people read on Google. Clear, unique titles tell both Google and customers what each page offers — directly lifting clicks.",
      difficulty: "no_code",
      estimatedTime: "5–10 mins",
      platformSteps: {
        wordpress: [
          "Open the page in WordPress and scroll to Yoast SEO or Rank Math.",
          "Edit the 'SEO Title' field so it clearly names the specific service or topic (aim for 50–60 characters).",
          "Make sure no two pages share the exact same title, then click Update.",
        ],
        shopify: [
          "Go to Online Store → Pages (or Products / Collections) and open the affected item.",
          "Scroll to the bottom and click 'Edit' inside the 'Search engine listing' section.",
          "Write a clear, unique Page Title (50–60 characters) with your main offering first, then click Save.",
        ],
        webflow: [
          "Open the Pages panel in Webflow Designer and click the gear icon next to the affected page.",
          "Fill in the 'Title Tag' under SEO Settings (keep it 50–60 characters and unique to this page).",
          "Save and Publish your site.",
        ],
        wix: [
          "Open Pages & Menu → click the three dots next to the page → SEO Basics.",
          "Update 'Title tag' (Wix) or Page Settings → SEO → 'SEO Title' (Squarespace) to a clear 50–60 character headline.",
          "Publish your changes.",
        ],
        developer: [
          "Update the <title> tag (or Next.js metadata.title) on each listed URL so every page has a unique 50–60 character title.",
          "Put the main topic or product near the beginning and your brand name at the end.",
          "Avoid reusing one default site-wide title across inner pages.",
        ],
      },
      exampleLabel: "Ideal page title format (50–60 characters)",
      exampleCode: `<title>Main Product or Service — Key Benefit | Your Brand</title>`,
      verifySteps: [
        "Hover over the browser tab on each updated page to confirm the new unique headline appears.",
        "Click 'I Fixed It — Check Live Site' below to verify the updated title immediately.",
      ],
    });
  }

  if (key.includes("META_DESCRIPTION") || key.includes("DESCRIPTION") || key.includes("SNIPPET") || key.includes("CTR")) {
    return finalize({
      whatIsWrong:
        "The short summary shown underneath your link in Google search results (meta description) is missing, duplicated, or not compelling enough to earn clicks.",
      whyItMatters:
        "A clear 1–2 sentence summary acts like free ad copy on Google. Better descriptions bring more visitors even without changing your ranking position.",
      difficulty: "no_code",
      estimatedTime: "10 mins",
      platformSteps: {
        wordpress: [
          "Open the page in WordPress and scroll down to Yoast SEO or Rank Math.",
          "Write a clear 140–155 character summary in the 'Meta Description' box explaining what visitors get.",
          "Include one real benefit (fast delivery, transparent pricing, or location) and click Update.",
        ],
        shopify: [
          "Open the Page, Product, or Collection in your Shopify admin.",
          "Scroll to 'Search engine listing' → click 'Edit'.",
          "Write a concise 140–155 character Description explaining why someone should click, then click Save.",
        ],
        webflow: [
          "Open Pages → click the Settings gear icon on the affected page.",
          "Enter a unique 140–155 character summary in 'Meta Description' under SEO Settings.",
          "Save and Publish your site.",
        ],
        wix: [
          "Go to Pages & Menu → three dots → SEO Basics → 'Meta description'.",
          "Write a unique 140–155 character summary for that page (or Page Settings → SEO in Squarespace).",
          "Publish your site.",
        ],
        developer: [
          "Add a unique <meta name=\"description\" content=\"...\" /> (135–155 characters) for each listed URL.",
          "Summarize the exact offer on that page with a clear call to action instead of repeating generic site copy.",
        ],
      },
      exampleLabel: "Meta description format (135–155 characters)",
      exampleCode: `<meta name="description" content="Clear 1-sentence summary of what this page offers, who it helps, and what to do next." />`,
      verifySteps: [
        "View Page Source on the updated URL and confirm the new meta description appears cleanly.",
        "Click 'I Fixed It — Check Live Site' below to log the change and track CTR lift.",
      ],
    });
  }

  if (key.includes("SCHEMA") || key.includes("STRUCTURED") || key.includes("JSON_LD") || key.includes("JSON-LD")) {
    return finalize({
      whatIsWrong:
        "This page is missing structured business/product labels (called Schema markup) that help Google and AI assistants like ChatGPT read your facts accurately.",
      whyItMatters:
        "Structured data unlocks richer Google listings (like FAQs, business info, and product details) and makes AI search engines much more confident citing your brand.",
      difficulty: "developer",
      estimatedTime: "20–30 mins",
      platformSteps: {
        wordpress: [
          "Open Yoast SEO → Settings → Site representation (or Rank Math → Titles & Meta → Local/Organization).",
          "Fill in your official business name, logo, and contact info — the plugin outputs Schema automatically.",
          "For FAQs or Products, use the built-in Yoast/Rank Math FAQ block or WooCommerce Product schema.",
        ],
        shopify: [
          "Most modern Shopify themes include basic Product schema; check Online Store → Themes → Customize.",
          "To add Organization or FAQ schema without coding, install a lightweight JSON-LD SEO app or paste the snippet into theme.liquid.",
          "Save and test your live URL in Google's free Rich Results Test.",
        ],
        webflow: [
          "Open the affected Page Settings → scroll to Custom Code → 'Inside <head> tag'.",
          "Paste the JSON-LD script block below with your exact business facts filled in.",
          "Save and Publish your site.",
        ],
        wix: [
          "In Wix, go to Pages & Menu → SEO Basics → Advanced SEO → Structured Data Markup → Add New Markup.",
          "Paste the JSON-LD snippet below with your real business details and Apply.",
          "In Squarespace, add the script under Page Settings → Advanced → Page Header Code Injection.",
        ],
        developer: [
          "Embed valid JSON-LD structured data (Organization/LocalBusiness on homepage, Product/Service/FAQPage on key pages).",
          "Only include truthful facts visibly shown on the page (never fabricate ratings or prices).",
          "Validate the live page with Google Rich Results Test until 0 critical errors appear.",
        ],
      },
      exampleLabel: "Standard Organization JSON-LD (replace bracketed values)",
      exampleCode: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Official Business Name",
  "url": "${origin}",
  "logo": "${origin}/logo.png"
}
</script>`,
      verifySteps: [
        "Paste your live page URL into Google's Rich Results Test (search.google.com/test/rich-results).",
        "Confirm valid items are detected with 0 errors, then verify live in Reigel.",
      ],
    });
  }

  if (key.includes("404") || key.includes("BROKEN") || key.includes("5XX") || key.includes("REDIRECT")) {
    return finalize({
      whatIsWrong:
        "One or more links on your site lead to a dead 'Page Not Found' error or server failure instead of a working page.",
      whyItMatters:
        "Broken pages frustrate real visitors (causing them to leave immediately) and waste Google’s crawl attention on dead ends.",
      difficulty: "cms_or_dev",
      estimatedTime: "15–20 mins",
      platformSteps: {
        wordpress: [
          "Check if the broken URL was renamed or deleted.",
          "Install or open the 'Redirection' plugin (or Rank Math → Redirections) and add a 301 Permanent Redirect from the old URL to the closest live page.",
          "Update any menu or page buttons that still link to the old broken URL.",
        ],
        shopify: [
          "In Shopify admin, go to Content → Menus (or Online Store → Navigation) → View URL redirects.",
          "Click 'Create URL redirect': enter the broken path in 'Redirect from' and the live replacement path in 'Redirect to'.",
          "Click Save redirect and fix any internal links pointing to the old address.",
        ],
        webflow: [
          "Open Site Settings → Publishing → 301 Redirects.",
          "Enter the broken Old Path and the live Redirect to Path, then click Add Redirect Path.",
          "Publish your site and update any broken button links in Designer.",
        ],
        wix: [
          "In Wix, go to Marketing & SEO → SEO → URL Redirect Manager → New Redirect.",
          "Enter the broken URL and redirect it permanently (301) to the closest live page.",
          "In Squarespace, add the rule under Settings → Developer Tools → URL Mappings.",
        ],
        developer: [
          "Fix broken internal <a href> links so they point directly to live HTTP 200 URLs.",
          "Add permanent HTTP 301 redirects for retired URLs that still get visits or backlinks (avoid redirect chains).",
          "For 5xx server errors, check application logs and resolve the crashing route.",
        ],
      },
      exampleLabel: "Redirect rule format",
      exampleCode: `${firstUrl}  -->  301 Permanent Redirect  -->  ${origin}/`,
      verifySteps: [
        "Click the previously broken URL in an incognito browser window and verify it lands cleanly on a working page.",
        "Run a live verification check below to confirm the error is cleared.",
      ],
    });
  }

  if (key.includes("H1") || key.includes("HEADING")) {
    return finalize({
      whatIsWrong:
        "The page is missing a single clear main headline (H1), or it has multiple main headlines competing for attention.",
      whyItMatters:
        "Both human readers and Google rely on the main headline at the top of the page to immediately understand what the page is about.",
      difficulty: "no_code",
      estimatedTime: "5–10 mins",
      platformSteps: {
        wordpress: [
          "Open the affected page in the WordPress editor.",
          "Ensure the main headline at the top uses 'Heading 1 (H1)' and clearly describes the page.",
          "Change any secondary section titles below it to H2 or H3, then click Update.",
        ],
        shopify: [
          "Open the page or theme section in Online Store → Themes → Customize.",
          "Make sure the top hero headline is set to Heading 1 (H1) and your store logo uses normal text/image (not H1).",
          "Save your theme changes.",
        ],
        webflow: [
          "Open the page in Webflow Designer and select the main hero title.",
          "Set its tag to H1 (and make sure every other heading on the page is H2, H3, or H4).",
          "Publish your changes.",
        ],
        wix: [
          "Open the page in the Wix or Squarespace editor and select the main top title.",
          "Set the text style to 'Heading 1' — keep only ONE Heading 1 per page and use Heading 2 for sections.",
          "Click Publish.",
        ],
        developer: [
          "Ensure every public page renders exactly one visible <h1> matching the core topic of that route.",
          "Use <span> or <a> (never <h1>) for header logos, and organize subsections with <h2> / <h3>.",
        ],
      },
      exampleLabel: "Clean page heading hierarchy",
      exampleCode: `<h1>Main Page Headline (only 1 per page)</h1>
<h2>Key Benefits or Services</h2>
<h2>Frequently Asked Questions</h2>`,
      verifySteps: [
        "Visit the updated page and confirm one clear main headline sits at the top.",
        "Click 'I Fixed It — Check Live Site' below to confirm the H1 check passes.",
      ],
    });
  }

  if (key.includes("ALT") || key.includes("IMAGE")) {
    return finalize({
      whatIsWrong:
        "Some images on your site don’t have a short text description (called Alt Text) explaining what is in the picture.",
      whyItMatters:
        "Google cannot 'see' images the way humans do without Alt Text. Adding short factual descriptions helps your images rank in Google Images and makes your site accessible.",
      difficulty: "no_code",
      estimatedTime: "10–15 mins",
      platformSteps: {
        wordpress: [
          "Open the page in WordPress (or go to Media → Library) and click an image.",
          "Type a short, natural description of what the image shows into the 'Alternative Text' box.",
          "Save / Update the page.",
        ],
        shopify: [
          "Open your Product or Page in Shopify and click directly on the image.",
          "Click 'Add alt text' and type a concise factual description of the product or photo.",
          "Click Save alt text.",
        ],
        webflow: [
          "Select the image element in Webflow Designer (or open the Assets panel).",
          "Click the gear icon and fill in 'Alt text' with a clear description of the image.",
          "Publish your changes.",
        ],
        wix: [
          "Click the image in the Wix Editor → Settings → fill in 'What's in the image? Tell Google'.",
          "In Squarespace, edit the image block and fill in the 'Image Alt Text' field.",
          "Publish your site.",
        ],
        developer: [
          "Add concise, factual alt=\"...\" text to all meaningful <img> tags (use alt=\"\" for purely decorative icons).",
          "Include width/height attributes and WebP/AVIF formats to prevent layout shifts.",
        ],
      },
      exampleLabel: "Clean image tag example",
      exampleCode: `<img src="/images/product.webp" alt="Clear description of what the photo shows" loading="lazy" />`,
      verifySteps: [
        "Confirm all main product, team, and hero images have plain descriptions filled in.",
        "Run a live verification or website re-audit to confirm missing alt warnings drop.",
      ],
    });
  }

  if (key.includes("OPEN_GRAPH") || key.includes("OG_") || key.includes("SOCIAL") || key.includes("TWITTER")) {
    return finalize({
      whatIsWrong:
        "This page doesn’t specify a custom share title, summary, or preview image for WhatsApp, LinkedIn, Facebook, or X.",
      whyItMatters:
        "When you or a customer shares your link on WhatsApp or LinkedIn, a crisp preview card with an image gets far more clicks and looks much more trustworthy.",
      difficulty: "no_code",
      estimatedTime: "10 mins",
      platformSteps: {
        wordpress: [
          "Open the page → scroll to Yoast SEO or Rank Math → click the 'Social' tab.",
          "Upload a clean 1200×630 preview image and set the share title and description.",
          "Click Update.",
        ],
        shopify: [
          "Go to Online Store → Preferences → 'Social sharing image' for your store-wide default.",
          "Upload a crisp 1200×630 banner image and click Save.",
        ],
        webflow: [
          "Open Page Settings → scroll to 'Open Graph Settings'.",
          "Check 'Same as SEO Title/Description' and paste your 1200×630 preview image URL, then Publish.",
        ],
        wix: [
          "Open Pages & Menu → SEO Basics → 'Social Share' tab.",
          "Upload your share image (1200×630) and confirm the share title/description, then Publish.",
        ],
        developer: [
          "Add og:title, og:description, og:url, and an absolute 1200×630 og:image inside <head>.",
          "Confirm the og:image URL is publicly accessible (HTTP 200 OK).",
        ],
      },
      exampleLabel: "Social preview tags inside <head>",
      exampleCode: `<meta property="og:title" content="Your Page Title" />
<meta property="og:description" content="Short summary shown when shared." />
<meta property="og:image" content="${origin}/share-image.png" />`,
      verifySteps: [
        "Paste your URL into a WhatsApp draft message or LinkedIn Post Inspector to verify the preview image appears.",
      ],
    });
  }

  if (key.includes("SLOW") || key.includes("SPEED") || key.includes("TTFB") || key.includes("LCP") || key.includes("PERFORMANCE")) {
    return finalize({
      whatIsWrong:
        "This page takes too long to load on mobile phones or desktop browsers.",
      whyItMatters:
        "Most mobile visitors leave if a page takes longer than 3 seconds to appear — costing you leads and hurting your Google rankings.",
      difficulty: "developer",
      estimatedTime: "30–60 mins",
      platformSteps: {
        wordpress: [
          "Compress large hero photos before uploading (keep images under 150 KB in WebP format).",
          "Enable page caching and image optimization (e.g., WP Rocket, LiteSpeed Cache, or Cloudflare).",
          "Remove heavy unused plugins or chat widgets that slow down initial page load.",
        ],
        shopify: [
          "Audit installed apps under Settings → Apps and uninstall any unused scripts injecting storefront code.",
          "Replace oversized PNG banners with compressed WebP/JPG images under 200 KB.",
          "Keep homepage hero sections lightweight (avoid auto-playing heavy background videos on mobile).",
        ],
        webflow: [
          "Open the Assets panel and run Webflow's built-in 'Compress' tool to convert images to WebP.",
          "Set below-the-fold images to 'Lazy load' and your top hero image to 'Eager load'.",
          "Defer third-party scripts placed in Custom Code, then Publish.",
        ],
        wix: [
          "Resize and compress oversized hero images before uploading.",
          "Limit custom third-party embeds/widgets above the fold so the main content paints immediately.",
          "Check Wix Site Speed Dashboard for any heavy apps slowing mobile load.",
        ],
        developer: [
          "Enable CDN / full-page caching so server response time (TTFB) stays under 500ms.",
          "Serve hero images as compressed WebP/AVIF (<150 KB) with fetchpriority=\"high\" and lazy-load below-the-fold media.",
          "Defer non-critical third-party scripts so they never block first paint.",
        ],
      },
      verifySteps: [
        `Test ${firstUrl} on Google PageSpeed Insights (pagespeed.web.dev) and confirm mobile load time improves.`,
      ],
    });
  }

  if (key.includes("THIN") || key.includes("WORD") || key.includes("CONTENT") || key.includes("QUESTION") || key.includes("FAQ") || key.includes("COMPETITOR")) {
    return finalize({
      whatIsWrong:
        "This page doesn’t have enough helpful, detailed information to answer a buyer’s real questions compared to top-ranking sites.",
      whyItMatters:
        "Google and AI assistants recommend pages that clearly explain what you offer, who it’s for, pricing/process, and common customer questions.",
      difficulty: "no_code",
      estimatedTime: "20–30 mins",
      platformSteps: {
        wordpress: [
          "Click 'Draft with AI (Content Studio)' below to generate ready-to-use copy tailored to your business.",
          "Open the page in WordPress and add clear sections: What's included, How it works, and 3–5 real buyer FAQs.",
          "Click Update to publish the improved content.",
        ],
        shopify: [
          "Use Content Studio below to draft helpful product/collection copy and buyer FAQs.",
          "Paste the approved copy into your Product, Collection, or Page description in Shopify admin.",
          "Click Save.",
        ],
        webflow: [
          "Generate a clean outline and FAQ block in Content Studio below.",
          "Add the updated sections directly to your page or CMS Collection item in Webflow.",
          "Publish your site.",
        ],
        wix: [
          "Draft the new copy and FAQs using Content Studio below.",
          "Add a clear benefits section and FAQ block to the page in Wix or Squarespace.",
          "Click Publish.",
        ],
        developer: [
          "Expand the page with 450–800+ words of truthful, structured buyer information (specs, delivery/process, and FAQs).",
          "Use clear H2/H3 headings and matching FAQPage structured data where appropriate.",
        ],
      },
      verifySteps: [
        "Read the updated page as a first-time buyer and confirm it answers their top 3 pre-purchase questions clearly.",
        "Click 'I Fixed It — Check Live Site' below so Reigel tracks ranking and traffic lift.",
      ],
    });
  }

  if (key.includes("LOCAL") || key.includes("MAPS") || key.includes("GBP")) {
    return finalize({
      whatIsWrong:
        "Your Google Maps profile or local area pages are missing signals that help nearby customers find and trust your business.",
      whyItMatters:
        "People searching 'near me' or by neighborhood usually pick from the top 3 Google Maps results — fixing local signals drives direct calls and visits.",
      difficulty: "no_code",
      estimatedTime: "10–15 mins",
      platformSteps: {
        wordpress: [
          "Open Local & Maps in Reigel to check your Google Business Profile checklist and missing directories.",
          "Ensure your exact Business Name, Address, and Phone appear consistently in your website footer and contact page.",
          "Publish dedicated service-area details for the neighborhoods you serve.",
        ],
        shopify: [
          "Add your full business address, service areas, and phone number clearly on your Contact page and footer.",
          "Keep your Google Business Profile updated weekly using Local & Maps → Listings & Posts.",
        ],
        webflow: [
          "Ensure your footer and Contact page match your Google Business Profile name, address, and phone word-for-word.",
          "Add neighborhood service coverage details on your main service pages and Publish.",
        ],
        wix: [
          "Update your Contact page and site footer so your address and phone match your Google Maps listing identically.",
          "Share your Review QR poster from Local & Maps → Reviews with happy customers.",
        ],
        developer: [
          "Add LocalBusiness JSON-LD with verified NAP (Name, Address, Phone), opening hours, and service areas.",
          "Link your Google Business Profile website URL with UTM tracking parameters.",
        ],
      },
      verifySteps: [
        "Confirm your business name, address, and phone match identically across your site and Google Maps.",
      ],
    });
  }

  // Universal clean fallback for any other finding
  const isOwnerFriendly = input.fixClass === "AUTO" || key.includes("AI_VISIBILITY");
  return finalize({
    whatIsWrong:
      input.summary?.trim() ||
      `Reigel detected an opportunity to improve "${input.title}" on your website.`,
    whyItMatters:
      "Resolving this issue helps Google and AI assistants understand your pages more clearly, improving visibility and customer clicks.",
    difficulty: isOwnerFriendly ? "cms_or_dev" : "developer",
    estimatedTime: "15–20 mins",
    platformSteps: {
      wordpress: [
        "Review the specific recommendation and affected pages listed above.",
        "Open each page in WordPress (or Yoast / Rank Math SEO settings) and apply the update.",
        "Click Update and verify the live page below.",
      ],
      shopify: [
        "Review the specific recommendation and affected pages listed above.",
        "Open the relevant Page, Product, or Theme section in Shopify admin and apply the change.",
        "Click Save and verify the live page below.",
      ],
      webflow: [
        "Review the specific recommendation and affected pages listed above.",
        "Open the relevant Page Settings or Designer canvas in Webflow, make the update, and Publish.",
      ],
      wix: [
        "Review the specific recommendation and affected pages listed above.",
        "Open the relevant page in Wix or Squarespace, apply the change under Page Editor or SEO Basics, and Publish.",
      ],
      developer: [
        input.recommendedAction?.trim() || `Review the affected URLs and resolve: ${input.title}.`,
        "Test on one affected URL first to verify clean HTML/HTTP output before rolling out site-wide.",
      ],
    },
    verifySteps: [
      "Open one updated URL in your browser to confirm everything looks clean.",
      "Click 'I Fixed It — Check Live Site' below so Reigel verifies the fix automatically.",
    ],
  });
}
