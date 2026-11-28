/**
 * Sandboxed DOM patcher for Visual Before/After Website Previews.
 *
 * Injects isolated CSS highlight rings, callout badges, live H1/copy swaps,
 * image alt-text outlines, and FAQ/AI answer preview blocks directly into
 * a sanitized third-party website's `srcDoc` HTML.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PREVIEW_OVERLAY_CSS = `
<style data-reigel-preview="1">
  .reigel-hl-before {
    outline: 3px dashed hsl(38 92% 50%) !important;
    outline-offset: 4px !important;
    position: relative !important;
    background: hsl(38 92% 50% / 0.08) !important;
    border-radius: 6px !important;
  }
  .reigel-hl-after {
    outline: 3px solid hsl(142 76% 36%) !important;
    outline-offset: 4px !important;
    position: relative !important;
    background: hsl(142 76% 36% / 0.10) !important;
    border-radius: 6px !important;
  }
  .reigel-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
    padding: 3px 9px;
    border-radius: 999px;
    margin-bottom: 6px;
    box-shadow: 0 2px 8px hsl(0 0% 0% / 0.12);
  }
  .reigel-badge-before { background: hsl(48 96% 89%); color: hsl(23 83% 31%); border: 1px solid hsl(38 92% 50%); }
  .reigel-badge-after { background: hsl(141 84% 93%); color: hsl(143 64% 24%); border: 1px solid hsl(142 76% 36%); }
  .reigel-faq-box {
    max-width: 960px;
    margin: 32px auto;
    padding: 24px 28px;
    border-radius: 16px;
    border: 2px solid hsl(142 76% 36%);
    background: hsl(138 76% 97%);
    color: hsl(222 47% 11%);
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    box-shadow: 0 8px 24px hsl(142 76% 36% / 0.12);
  }
  .reigel-faq-box h2 { font-size: 20px; font-weight: 800; margin: 8px 0 12px; color: hsl(222 47% 11%); }
  .reigel-faq-box p { font-size: 14px; line-height: 1.6; color: hsl(215 25% 27%); margin: 0 0 10px; }
  img.reigel-img-missing-alt {
    outline: 3px dashed hsl(0 72% 51%) !important;
    outline-offset: 2px !important;
  }
  img.reigel-img-fixed-alt {
    outline: 3px solid hsl(142 76% 36%) !important;
    outline-offset: 2px !important;
  }
</style>
`;

export function buildPatchedHtml(
  sanitizedHtml: string,
  mode: "before" | "after",
  opts: {
    proposedH1: string;
    proposedParagraph: string;
    injectFaq: boolean;
    highlightMissingAlt: boolean;
    domainLabel: string;
  },
): string {
  let html = sanitizedHtml;

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${PREVIEW_OVERLAY_CSS}\n</head>`);
  } else {
    html = `${PREVIEW_OVERLAY_CSS}\n${html}`;
  }

  if (opts.proposedH1.trim()) {
    let h1Replaced = false;
    html = html.replace(/<h1(\b[^>]*)>([\s\S]*?)<\/h1>/i, (full, attrs, inner) => {
      if (h1Replaced) return full;
      h1Replaced = true;
      if (mode === "before") {
        return `<div class="reigel-hl-before"><span class="reigel-badge reigel-badge-before">BEFORE · Current H1</span><h1${attrs}>${inner}</h1></div>`;
      }
      return `<div class="reigel-hl-after"><span class="reigel-badge reigel-badge-after">AFTER · Updated H1 by Reigel</span><h1${attrs}>${escapeHtml(opts.proposedH1.trim())}</h1></div>`;
    });
  }

  if (opts.proposedParagraph.trim()) {
    let pReplaced = false;
    html = html.replace(/<p(\b[^>]*)>([\s\S]*?)<\/p>/i, (full, attrs, inner) => {
      if (pReplaced) return full;
      pReplaced = true;
      if (mode === "before") {
        return `<div class="reigel-hl-before"><span class="reigel-badge reigel-badge-before">BEFORE · Current Copy</span><p${attrs}>${inner}</p></div>`;
      }
      return `<div class="reigel-hl-after"><span class="reigel-badge reigel-badge-after">AFTER · Improved Copy</span><p${attrs}>${escapeHtml(opts.proposedParagraph.trim())}</p></div>`;
    });
  }

  if (opts.highlightMissingAlt) {
    html = html.replace(/<img\b[^>]*>/gi, (imgTag) => {
      const altMatch = imgTag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const altVal = (altMatch?.[1] ?? altMatch?.[2] ?? "").trim();
      if (altVal) return imgTag;
      const cls = mode === "before" ? "reigel-img-missing-alt" : "reigel-img-fixed-alt";
      if (/\bclass\s*=\s*"/i.test(imgTag)) {
        return imgTag.replace(/\bclass\s*=\s*"/i, `class="${cls} `);
      }
      return imgTag.replace(/^<img\b/i, `<img class="${cls}"`);
    });
  }

  if (opts.injectFaq && mode === "after") {
    const faqHtml = `
      <section class="reigel-faq-box">
        <span class="reigel-badge reigel-badge-after">✨ NEW SECTION ADDED BY REIGEL (SEO + AI CITATION BLOCK)</span>
        <h2>Quick Answers &amp; Frequently Asked Questions</h2>
        <p><strong>What makes ${escapeHtml(opts.domainLabel)} stand out?</strong> Direct, structured answers written for both visitors and AI assistants (ChatGPT, Perplexity, Google AI Overviews) with matching FAQPage JSON-LD schema.</p>
        <p><strong>How do delivery timings, pricing, and quality checks work?</strong> Transparent details added right on the page so shoppers convert faster without leaving your site.</p>
      </section>
    `;
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${faqHtml}\n</body>`);
    } else {
      html = `${html}\n${faqHtml}`;
    }
  }

  return html;
}
