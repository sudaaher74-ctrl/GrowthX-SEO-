"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitPullRequest,
  Globe,
  Loader2,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import type { ContentStudioKind, ContentStudioPiece } from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import { useWorkspace } from "@/hooks/use-growthx";

const KIND_OPTIONS: Array<{ value: ContentStudioKind; label: string; hint: string }> = [
  { value: "ARTICLE", label: "Full SEO Article (Markdown)", hint: "800–1500 words grounded in site crawl & search data" },
  { value: "BRIEF", label: "SEO Content Brief", hint: "Outline, search intent, internal links, and angle" },
  { value: "FAQ", label: "FAQ Block (6–10 Q&As)", hint: "Targets buyer questions & AI answer citations" },
  { value: "LANDING_PAGE_OUTLINE", label: "Local / Service Landing Page Outline", hint: "Proposed H1, meta description, and local sections" },
  { value: "SCHEMA_MARKUP", label: "JSON-LD Structured Data", hint: "Validated Schema.org JSON-LD grounded in page facts" },
  { value: "GBP_POST", label: "Google Business Profile Post", hint: "Under 1500 chars with a clear CTA" },
];

function inferKindFromFinding(finding: GrowthOpportunity): ContentStudioKind {
  const hay = `${finding.title} ${finding.recommendedAction}`.toLowerCase();
  if (hay.includes("schema") || hay.includes("json-ld")) return "SCHEMA_MARKUP";
  if (hay.includes("faq")) return "FAQ";
  if (hay.includes("local") || hay.includes("city") || hay.includes("landing")) return "LANDING_PAGE_OUTLINE";
  if (hay.includes("brief")) return "BRIEF";
  return "ARTICLE";
}

function markdownToPreviewHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return md
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return "";
      if (t.startsWith("### ")) return `<h3>${esc(t.slice(4))}</h3>`;
      if (t.startsWith("## ")) return `<h2>${esc(t.slice(3))}</h2>`;
      if (t.startsWith("# ")) return `<h1>${esc(t.slice(2))}</h1>`;
      return `<p>${esc(t)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

export function ContentStudioView({
  initialFinding,
  initialQuery,
  initialTopic,
  initialKind,
  onClearInitialFinding,
}: {
  initialFinding?: GrowthOpportunity | null;
  initialQuery?: string | null;
  initialTopic?: string | null;
  initialKind?: ContentStudioKind | null;
  onClearInitialFinding?: () => void;
}) {
  const queryClient = useQueryClient();
  const { projectId } = useWorkspace();

  const resolvedSeedKey = `${initialFinding?.id ?? ""}|${initialQuery ?? ""}|${initialTopic ?? ""}|${initialKind ?? ""}`;
  const [seedKey, setSeedKey] = useState<string>(resolvedSeedKey);
  const [kind, setKind] = useState<ContentStudioKind>(() =>
    initialKind ?? (initialFinding ? inferKindFromFinding(initialFinding) : "ARTICLE"),
  );
  const [topic, setTopic] = useState<string>(() => initialTopic ?? initialFinding?.title ?? "");
  const [targetQuery, setTargetQuery] = useState<string>(
    () =>
      initialQuery ??
      initialFinding?.evidence.find((e) => /query|keyword/i.test(e.label))?.value ??
      "",
  );
  const [pageUrl, setPageUrl] = useState<string>(() => initialFinding?.affectedPages?.[0] ?? "");
  const [location, setLocation] = useState<string>("");

  // Sync when a new finding or keyword deep-link arrives
  if (resolvedSeedKey !== seedKey) {
    setSeedKey(resolvedSeedKey);
    if (initialFinding) {
      setKind(initialKind ?? inferKindFromFinding(initialFinding));
      setTopic(initialTopic ?? initialFinding.title);
      setTargetQuery(
        initialQuery ??
          initialFinding.evidence.find((e) => /query|keyword/i.test(e.label))?.value ??
          "",
      );
      setPageUrl(initialFinding.affectedPages?.[0] ?? "");
    } else if (initialQuery || initialTopic) {
      setKind(initialKind ?? "ARTICLE");
      setTopic(initialTopic ?? `SEO Guide for "${initialQuery}"`);
      setTargetQuery(initialQuery ?? "");
      setPageUrl("");
    }
  }

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<{
    id: string;
    title: string;
    metaDescription: string;
    body: string;
  } | null>(null);
  const [cmsPlatform, setCmsPlatform] = useState<"WORDPRESS" | "SHOPIFY" | "WEBFLOW">("WORDPRESS");
  const [cmsMode, setCmsMode] = useState<"draft" | "publish">("draft");
  const [copiedMode, setCopiedMode] = useState<"md" | "html" | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string; url?: string | null } | null>(null);

  const draftsQuery = useQuery({
    queryKey: ["content-studio-drafts", projectId],
    queryFn: () => api.contentStudio.list(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const cmsConnectionsQuery = useQuery({
    queryKey: ["cms-connections", projectId],
    queryFn: () => api.getAllCmsConnections(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const repoQuery = useQuery({
    queryKey: ["automation-repo", projectId],
    queryFn: () => api.getRepository(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const drafts = draftsQuery.data ?? [];
  const activePiece: ContentStudioPiece | null =
    drafts.find((d) => d.id === selectedId) ?? drafts[0] ?? null;

  const editState =
    activePiece && editorDraft && editorDraft.id === activePiece.id
      ? editorDraft
      : activePiece
        ? {
            id: activePiece.id,
            title: activePiece.title,
            metaDescription: activePiece.metaDescription ?? "",
            body: activePiece.body ?? "",
          }
        : null;

  const generateMutation = useMutation({
    mutationFn: () =>
      api.contentStudio.generate(projectId!, {
        kind,
        topic: topic.trim() || undefined,
        targetQuery: targetQuery.trim() || undefined,
        pageUrl: pageUrl.trim() || undefined,
        location: location.trim() || undefined,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["content-studio-drafts", projectId] });
      setSelectedId(created.id);
      setEditorDraft(null);
      setNotice({
        tone: "good",
        text: `Drafted "${created.title}" grounded in your site's measured crawl and search data.`,
      });
      onClearInitialFinding?.();
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.contentStudio.update(projectId!, editState!.id, {
        title: editState!.title,
        metaDescription: editState!.metaDescription,
        body: editState!.body,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["content-studio-drafts", projectId] });
      setEditorDraft(null);
      setNotice({ tone: "good", text: "Saved draft edits." });
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ pieceId, decision }: { pieceId: string; decision: "APPROVE" | "REJECT" }) =>
      api.contentStudio.review(projectId!, pieceId, decision),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["content-studio-drafts", projectId] });
      setNotice({
        tone: "good",
        text:
          updated.status === "COMMITTED"
            ? `Approved "${updated.title}" for publishing.`
            : `Marked "${updated.title}" as rejected.`,
      });
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const publishCmsMutation = useMutation({
    mutationFn: (pieceId: string) =>
      api.contentStudio.publishCms(projectId!, pieceId, {
        platform: cmsPlatform,
        publishMode: cmsMode,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["content-studio-drafts", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["fix-impact-ledger", projectId] });
      setNotice({
        tone: "good",
        text: res.publishResult.message,
        url: res.publishResult.externalUrl,
      });
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const publishGitHubMutation = useMutation({
    mutationFn: (pieceId: string) => api.contentStudio.publishGitHub(projectId!, [pieceId]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automation-runs", projectId] });
      setNotice({
        tone: "good",
        text: "Queued GitHub PR to commit this Markdown/MDX draft to your repository.",
      });
    },
    onError: (err) => setNotice({ tone: "bad", text: errorMessage(err) }),
  });

  const handleCopy = async (mode: "md" | "html") => {
    if (!editState) return;
    const text = mode === "html" ? markdownToPreviewHtml(editState.body) : editState.body;
    await navigator.clipboard.writeText(text);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  };

  const handleDownloadMd = () => {
    if (!activePiece || !editState) return;
    const frontmatter = `---\ntitle: "${editState.title.replace(/"/g, '\\"')}"\ndescription: "${editState.metaDescription.replace(/"/g, '\\"')}"\nslug: "${activePiece.slug}"\n---\n\n`;
    const blob = new Blob([frontmatter + editState.body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePiece.slug || "seo-draft"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const wpConnected = Boolean(cmsConnectionsQuery.data?.wordpress?.connected);
  const shopifyConnected = Boolean(cmsConnectionsQuery.data?.shopify?.connected);
  const webflowConnected = Boolean(cmsConnectionsQuery.data?.webflow?.connected);
  const githubConnected = Boolean(repoQuery.data?.owner && repoQuery.data?.name);

  if (!projectId) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-6 text-xs text-brand-500">
        Select a website to open Grounded Content Studio.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Grounded Generator Card */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-950">
                Grounded SEO Content Studio
              </h2>
              <p className="text-[11.5px] text-brand-500">
                Close the loop on MANUAL content, competitor, and AI visibility gaps using only measured site &amp; Search Console evidence.
              </p>
            </div>
          </div>
          {initialFinding && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-signal-400/40 bg-signal-400/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-brand-950">
              Pre-filled from Fix Engine finding
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-brand-900">Content Format</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ContentStudioKind)}
              className="w-full rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-medium text-brand-950"
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-brand-900">Topic / Opportunity Title</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Complete guide to technical SEO audits"
              className="w-full rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-xs text-brand-950"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-brand-900">Target Search Query</label>
            <input
              type="text"
              value={targetQuery}
              onChange={(e) => setTargetQuery(e.target.value)}
              placeholder="e.g. striking-distance keyword"
              className="w-full rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-xs text-brand-950"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-brand-900">
              {kind === "LANDING_PAGE_OUTLINE" ? "Target City / Location" : "Reference Page URL (optional)"}
            </label>
            {kind === "LANDING_PAGE_OUTLINE" ? (
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Austin, TX"
                className="w-full rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-xs text-brand-950"
              />
            ) : (
              <input
                type="text"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="https://yoursite.com/page"
                className="w-full rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 font-mono text-[11px] text-brand-950"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-brand-400">
            Zero invented statistics, prices, or testimonials — missing business facts are marked <code className="font-mono">[CONFIRM: ...]</code> for review.
          </p>
          <button
            type="button"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal-400 px-4 py-2 text-xs font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>{generateMutation.isPending ? "Drafting from Site Evidence…" : "Generate Grounded Draft"}</span>
          </button>
        </div>

        {notice && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
              notice.tone === "good"
                ? "border-success-200 bg-success-50 text-success-800"
                : "border-error-200 bg-error-50 text-error-800"
            }`}
          >
            <span>{notice.text}</span>
            {notice.url && (
              <a
                href={notice.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline"
              >
                <span>View Published</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Draft Library + Editor + Multi-Target Publisher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Saved Drafts */}
        <div className="lg:col-span-4 rounded-2xl border border-brand-200/80 bg-surface-1 overflow-hidden shadow-2xs">
          <div className="border-b border-brand-200 bg-surface-2 px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-brand-950 flex items-center gap-1.5">
              <FileText size={13} className="text-brand-600" />
              <span>Project Drafts ({drafts.length})</span>
            </h3>
          </div>
          {draftsQuery.isLoading ? (
            <p className="p-4 text-xs text-brand-500">Loading drafts…</p>
          ) : drafts.length === 0 ? (
            <p className="p-4 text-xs text-brand-500">
              No drafts yet. Generate a grounded article, brief, FAQ, or schema markup above — or click &ldquo;Draft in Content Studio&rdquo; on any Fix Engine finding.
            </p>
          ) : (
            <div className="divide-y divide-brand-200/60 max-h-[540px] overflow-y-auto">
              {drafts.map((item) => {
                const isSelected = activePiece?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setEditorDraft(null);
                    }}
                    className={`w-full text-left px-4 py-3 transition cursor-pointer ${
                      isSelected ? "bg-brand-50" : "hover:bg-surface-2/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase text-brand-500">
                        {item.kind.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold ${
                          item.status === "PUBLISHED"
                            ? "bg-success-50 text-success-700 border border-success-200"
                            : item.status === "COMMITTED"
                              ? "bg-primary-50 text-primary-700 border border-primary-200"
                              : item.status === "REJECTED"
                                ? "bg-error-50 text-error-700 border border-error-200"
                                : "bg-surface-2 text-brand-700 border border-brand-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-brand-950 line-clamp-2">{item.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-brand-400">
                      Updated {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Draft Editor & Publisher */}
        <div className="lg:col-span-8 rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-4">
          {!activePiece || !editState ? (
            <div className="flex h-64 items-center justify-center text-xs text-brand-400">
              Select or generate a draft to inspect, edit, and publish.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200/70 pb-3">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-brand-500">
                    {activePiece.kind.replace(/_/g, " ")} · /{activePiece.slug}
                  </span>
                  {activePiece.rationale && (
                    <p className="text-[11px] text-brand-500 mt-0.5">{activePiece.rationale}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-900 hover:bg-surface-3 cursor-pointer disabled:opacity-50"
                  >
                    <Save size={11} />
                    <span>{saveMutation.isPending ? "Saving…" : "Save Edits"}</span>
                  </button>
                  {activePiece.status === "DRAFTED" && (
                    <>
                      <button
                        type="button"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({ pieceId: activePiece.id, decision: "APPROVE" })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-success-600 px-2.5 py-1 text-[11px] font-bold text-surface-1 hover:bg-success-700 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 size={11} />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({ pieceId: activePiece.id, decision: "REJECT" })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-error-200 bg-error-50 px-2.5 py-1 text-[11px] font-semibold text-error-700 hover:bg-error-100 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle size={11} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-brand-700">Title</label>
                  <input
                    type="text"
                    value={editState.title}
                    onChange={(e) => setEditorDraft({ ...editState, title: e.target.value })}
                    className="w-full rounded-xl border border-brand-200 bg-surface-2/60 px-3 py-2 text-xs font-bold text-brand-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-brand-700">Meta Description</label>
                  <input
                    type="text"
                    value={editState.metaDescription}
                    onChange={(e) =>
                      setEditorDraft({ ...editState, metaDescription: e.target.value })
                    }
                    placeholder="Optional SEO meta description"
                    className="w-full rounded-xl border border-brand-200 bg-surface-2/60 px-3 py-2 text-xs text-brand-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-brand-700">
                    Draft Body (Markdown / JSON-LD)
                  </label>
                  <textarea
                    rows={12}
                    value={editState.body}
                    onChange={(e) => setEditorDraft({ ...editState, body: e.target.value })}
                    className="w-full rounded-xl border border-brand-200 bg-surface-2/60 p-3 font-mono text-[11.5px] leading-relaxed text-brand-950"
                  />
                </div>
              </div>

              {/* Export & Direct Publish Bar */}
              <div className="rounded-xl border border-brand-200/80 bg-surface-2/60 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                    Publish or Export Draft
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopy("md")}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-2 cursor-pointer"
                    >
                      {copiedMode === "md" ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                      <span>{copiedMode === "md" ? "Copied MD" : "Copy Markdown"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy("html")}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-2 cursor-pointer"
                    >
                      {copiedMode === "html" ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                      <span>{copiedMode === "html" ? "Copied HTML" : "Copy HTML"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMd}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-2 cursor-pointer"
                    >
                      <Download size={11} />
                      <span>Download .md</span>
                    </button>
                    {githubConnected && (
                      <button
                        type="button"
                        disabled={publishGitHubMutation.isPending}
                        onClick={() => publishGitHubMutation.mutate(activePiece.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-900 hover:bg-surface-2 cursor-pointer disabled:opacity-50"
                      >
                        <GitPullRequest size={11} />
                        <span>
                          {publishGitHubMutation.isPending ? "Opening PR…" : "GitHub PR"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Direct CMS Publish row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-200/70 pt-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={cmsPlatform}
                      onChange={(e) =>
                        setCmsPlatform(e.target.value as "WORDPRESS" | "SHOPIFY" | "WEBFLOW")
                      }
                      className="rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-[11px] font-semibold text-brand-900"
                    >
                      <option value="WORDPRESS">
                        WordPress {wpConnected ? "(Connected)" : "(Not connected)"}
                      </option>
                      <option value="SHOPIFY">
                        Shopify {shopifyConnected ? "(Connected)" : "(Not connected)"}
                      </option>
                      <option value="WEBFLOW">
                        Webflow {webflowConnected ? "(Connected)" : "(Not connected)"}
                      </option>
                    </select>

                    <select
                      value={cmsMode}
                      onChange={(e) => setCmsMode(e.target.value as "draft" | "publish")}
                      className="rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-[11px] font-semibold text-brand-900"
                    >
                      <option value="draft">Save as CMS Draft</option>
                      <option value="publish">Publish Live Now</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={
                      publishCmsMutation.isPending ||
                      (cmsPlatform === "WORDPRESS" && !wpConnected) ||
                      (cmsPlatform === "SHOPIFY" && !shopifyConnected) ||
                      (cmsPlatform === "WEBFLOW" && !webflowConnected)
                    }
                    onClick={() => publishCmsMutation.mutate(activePiece.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[11px] font-bold text-brand-50 hover:bg-brand-800 transition cursor-pointer disabled:opacity-50"
                  >
                    {publishCmsMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Globe size={12} />
                    )}
                    <span>
                      {publishCmsMutation.isPending
                        ? "Publishing…"
                        : `Send to ${cmsPlatform} (${cmsMode})`}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
