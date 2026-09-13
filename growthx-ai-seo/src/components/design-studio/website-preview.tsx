"use client";
import { useMemo, useState } from "react";
import { Monitor, RefreshCw, Smartphone, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignSuggestion } from "@/lib/api-client";
import { ScrollPanel } from "./scroll-panel";
import { QueryState } from "@/components/ui/query-state";

/**
 * The customer's real page, with the proposed content shown in place.
 *
 * Rendered from the stored HTML snapshot inside a sandboxed iframe, not
 * rebuilt as a mockup: the entire value of this screen is that the reviewer
 * sees their own typography, spacing and colour, so a generic wireframe would
 * defeat the point. When no snapshot exists the panel says so rather than
 * falling back to an invented page.
 *
 * The iframe carries no `allow-scripts`, and every script and event handler is
 * stripped from the HTML before it is written in. A customer's page is
 * untrusted input here — it is fetched from the open web — so it renders as
 * inert markup and cannot reach this origin.
 */

type Viewport = "desktop" | "mobile";
type Mode = "before" | "after";

const VIEWPORT_WIDTH: Record<Viewport, number> = { desktop: 1280, mobile: 390 };

/**
 * Remove anything executable from the snapshot.
 *
 * Belt and braces alongside the sandbox: the sandbox already blocks scripts,
 * but stripping them means a future change that relaxes the sandbox cannot
 * silently start executing a third party's page inside the dashboard.
 */
function inertHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Review chrome drawn inside the iframe, as literal colours.
 *
 * This is the one place in the app where a token cannot be used. The markup
 * below is written into a separate document — the customer's page — which has
 * none of this app's stylesheet, so `bg-success-50` would be an unknown class
 * and `var(--color-success-500)` an undefined variable. These are the success
 * token values, copied deliberately, and they exist only to mark the insertion
 * during review; none of it is ever published.
 */
const REVIEW_CHROME = {
  /** --color-success-500 */
  border: "#10b981",
  /** --color-success-50 */
  labelBackground: "#ecfdf5",
  /** --color-success-700 */
  labelText: "#047857",
} as const;

/**
 * The inserted block.
 *
 * Typography is deliberately left to inherit from the host page so the content
 * reads as part of the design; only the dashed frame and the label are styled
 * here, and both are marked as review chrome that will not ship.
 */
function insertedBlock(suggestion: DesignSuggestion, heading: string, body: string): string {
  const label = `AI INSERTED: ${(suggestion.contentType || "CONTENT").toUpperCase()}`;
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 1em 0">${escapeHtml(p)}</p>`)
    .join("");

  return `
    <div data-growthx-insert="1" style="position:relative;margin:24px 0;padding:28px 24px 24px;border:2px dashed ${REVIEW_CHROME.border};border-radius:12px;">
      <span style="position:absolute;top:-11px;left:16px;padding:2px 8px;border-radius:6px;background:${REVIEW_CHROME.labelBackground};color:${REVIEW_CHROME.labelText};font:600 11px/1.6 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;">${escapeHtml(label)}</span>
      ${heading ? `<h2 style="margin:0 0 .5em 0">${escapeHtml(heading)}</h2>` : ""}
      ${paragraphs}
    </div>`;
}

/**
 * Place the block against the slot's selector when the page gives us one,
 * falling back to the end of the main content.
 *
 * String insertion rather than DOM surgery because the snapshot is written
 * into the iframe as a document — there is no live DOM to query until it has
 * already rendered, and rendering twice makes the preview flash.
 */
function composeAfter(html: string, block: string, selectorId: string | null): string {
  if (selectorId) {
    // Anchor ids are the one selector shape that survives as plain text.
    const anchor = new RegExp(`(<[a-z]+[^>]*\\bid=["']${selectorId}["'][^>]*>)`, "i");
    if (anchor.test(html)) return html.replace(anchor, `$1${block}`);
  }
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${block}</main>`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return html + block;
}

export function WebsitePreview({
  suggestion,
  html,
  pageUrl,
  isLoading,
  error,
  onRefresh,
  /** Live edits from the inspector, so the preview matches what is approved. */
  draftHeading,
  draftBody,
}: {
  suggestion: DesignSuggestion | null;
  html: string | null;
  pageUrl: string | null;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
  draftHeading?: string;
  draftBody?: string;
}) {
  const [mode, setMode] = useState<Mode>("after");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [zoom, setZoom] = useState(0.55);

  const documentHtml = useMemo(() => {
    if (!html) return null;
    const safe = inertHtml(html);
    const base = pageUrl ? `<base href="${escapeHtml(pageUrl)}">` : "";
    const withBase = /<head[^>]*>/i.test(safe)
      ? safe.replace(/<head([^>]*)>/i, `<head$1>${base}`)
      : `${base}${safe}`;

    if (mode === "before" || !suggestion) return withBase;

    const heading = draftHeading ?? suggestion.heading ?? "";
    const body = draftBody ?? suggestion.body;
    const selectorId = suggestion.slot?.domSelector?.startsWith("#")
      ? suggestion.slot.domSelector.slice(1)
      : null;
    return composeAfter(withBase, insertedBlock(suggestion, heading, body), selectorId);
  }, [html, pageUrl, mode, suggestion, draftHeading, draftBody]);

  const width = VIEWPORT_WIDTH[viewport];

  return (
    <ScrollPanel
      title="Website Preview"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <Toggle
            options={[
              { id: "desktop", label: "Desktop", Icon: Monitor },
              { id: "mobile", label: "Mobile", Icon: Smartphone },
            ]}
            value={viewport}
            onChange={(v) => setViewport(v as Viewport)}
          />
          <Toggle
            options={[
              { id: "before", label: "Before" },
              { id: "after", label: "After" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />
          <span className="flex items-center rounded-lg border bg-white">
            <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>
              <ZoomOut size={13} />
            </IconButton>
            <span className="min-w-[38px] text-center font-mono text-[10.5px] text-brand-500">
              {Math.round(zoom * 100)}%
            </span>
            <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1, z + 0.1))}>
              <ZoomIn size={13} />
            </IconButton>
          </span>
          <IconButton label="Refresh preview" onClick={onRefresh} bordered>
            <RefreshCw size={13} />
          </IconButton>
        </div>
      }
    >

      <div className="min-h-0 flex-1 overflow-auto bg-brand-100 p-4">
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={!documentHtml}
          emptyTitle={suggestion ? "No page snapshot" : "Select a suggestion"}
          emptyBody={
            suggestion
              ? "This page has not been crawled, or its HTML was not stored. Run a crawl for this project to capture it, then reopen Design Studio."
              : "Choose a suggestion on the left to see exactly where the new content would appear on your site."
          }
        >
          <div className="flex justify-center">
            <div
              style={{
                width: width * zoom,
                // The iframe renders at its true viewport width and is then
                // scaled, so the page lays out exactly as it would at that
                // width rather than reflowing into a narrow box.
                height: 720 * zoom,
              }}
            >
              <iframe
                title={`${mode === "after" ? "Proposed" : "Current"} ${viewport} preview${pageUrl ? ` of ${pageUrl}` : ""}`}
                srcDoc={documentHtml ?? ""}
                sandbox=""
                className="border-0 bg-white shadow-sm"
                style={{
                  width,
                  height: 720,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          </div>
        </QueryState>
      </div>

      {pageUrl && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
          <span className="truncate font-mono text-[10.5px] text-brand-400">{pageUrl}</span>
          <span className="shrink-0 text-[10.5px] text-brand-400">
            {mode === "after" ? "Proposed" : "Current"} · {viewport}
          </span>
        </div>
      )}
    </ScrollPanel>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string; Icon?: React.ElementType }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <span className="inline-flex rounded-lg border bg-white p-0.5">
      {options.map((option) => {
        const Icon = option.Icon;
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
              active ? "bg-brand-950 text-white" : "text-brand-600 hover:bg-brand-100",
            )}
          >
            {Icon && <Icon size={12} />}
            {option.label}
          </button>
        );
      })}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  bordered,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-brand-500 transition hover:bg-brand-100 hover:text-brand-950",
        bordered && "border bg-white",
      )}
    >
      {children}
    </button>
  );
}
