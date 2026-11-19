export interface WhiteLabelMeta {
  enabled: boolean;
  agencyName: string;
  logoUrl: string | null;
  brandColor: string;
  contactLine: string | null;
  footerText: string | null;
}

export interface MonthlyReportPayload {
  domain: string;
  month: string;
  monthLabel: string;
  generatedAt: string;
  whiteLabel: WhiteLabelMeta;
  executiveSummary?: {
    wins: string[];
    workCompleted: string[];
    nextMonthFocus: string[];
  };
  kpis?: {
    clicks?: number | null;
    clicksDiff?: number | null;
    impressions?: number | null;
    ctrPct?: string | null;
    sessions?: number | null;
    sessionsDiff?: number | null;
    peakUsers?: number | null;
    healthScore?: number | null;
    pagesCrawled?: number | null;
    verifiedFixes?: number;
    rollbacks?: number;
    regressions?: number;
    aiCitationSharePct?: number | null;
    referringDomains?: number | null;
    verifiedBacklinks?: number | null;
  };
  topKeywords?: Array<{ query: string; clicks: number; impressions: number; position: number; ctr?: number }>;
  decliningKeywords?: Array<{ query: string; clicks: number; position: number; previousPosition?: number | null }>;
  aiVisibility?: {
    citationSharePct: number | null;
    averagePosition: number | null;
    byAssistant: Array<{ assistant: string; cited: number; checked: number; citationSharePct: number }>;
  } | null;
  backlinks?: {
    totalVerified: number;
    referringDomains: number;
    newCount: number;
    lostCount: number;
    topSources: Array<{ domain: string; url: string; status: string }>;
  } | null;
  competitors?: {
    summary: string | null;
    rivals: Array<{ label: string; pages: number; crawledAt: string | null }>;
  } | null;
  fixes?: Array<{
    title: string;
    url: string;
    field: string;
    status: string;
    verifiedAt?: string | null;
    pullRequestUrl?: string | null;
  }>;
  accountabilityEvents?: Array<{
    eventType: string;
    title: string;
    affectedUrl?: string | null;
    createdAt: string;
  }>;
  nextMonthPriorities?: Array<{
    title: string;
    source: string;
    potential: string;
    effort: string;
    roiNote?: string | null;
  }>;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeCssColor(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  return '#111827';
}

function safeImageUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return escapeHtml(trimmed);
  return null;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US').format(v);
}

/**
 * Generates a self-contained, print-safe A4 HTML document for server-side
 * Playwright PDF rendering with white-label branding and zero browser chrome.
 */
export function renderMonthlyReportHtml(
  payload: MonthlyReportPayload,
  agencyNotes?: string | null,
): string {
  const wl = payload.whiteLabel;
  const accent = safeCssColor(wl?.enabled ? wl.brandColor : '#111827');
  const brandTitle = escapeHtml(wl?.enabled && wl.agencyName ? wl.agencyName : 'GrowthX / Reigel AI');
  const logoSrc = wl?.enabled ? safeImageUrl(wl.logoUrl) : null;
  const kpis = payload.kpis ?? {};

  const kpiCards = [
    { label: 'Search Clicks', value: fmtNum(kpis.clicks) },
    { label: 'Impressions', value: fmtNum(kpis.impressions) },
    { label: 'Website Sessions', value: fmtNum(kpis.sessions) },
    { label: 'Site Health', value: kpis.healthScore != null ? `${kpis.healthScore}/100` : '—' },
    { label: 'AI Mention Share', value: kpis.aiCitationSharePct != null ? `${kpis.aiCitationSharePct}%` : '—' },
    { label: 'Referring Domains', value: fmtNum(kpis.referringDomains) },
    { label: 'Verified Fixes', value: fmtNum(kpis.verifiedFixes ?? payload.fixes?.length ?? 0) },
    { label: 'Regressions Caught', value: fmtNum(kpis.regressions ?? 0) },
  ];

  const renderBullets = (items?: string[], empty = 'No measured items recorded for this period.') =>
    items && items.length > 0
      ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : `<p class="muted">${escapeHtml(empty)}</p>`;

  const keywordsHtml =
    payload.topKeywords && payload.topKeywords.length > 0
      ? `<table><thead><tr><th>Keyword</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">Avg Position</th></tr></thead><tbody>${payload.topKeywords
          .slice(0, 12)
          .map(
            (k) =>
              `<tr><td>${escapeHtml(k.query)}</td><td class="num">${fmtNum(k.clicks)}</td><td class="num">${fmtNum(k.impressions)}</td><td class="num">#${Number(k.position).toFixed(1)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="muted">Connect Google Search Console to include monthly top keyword rankings.</p>';

  const backlinksHtml = payload.backlinks
    ? `<div class="mini-grid">
        <div class="mini-kpi"><span>Verified Links</span><strong>${fmtNum(payload.backlinks.totalVerified)}</strong></div>
        <div class="mini-kpi"><span>Referring Domains</span><strong>${fmtNum(payload.backlinks.referringDomains)}</strong></div>
        <div class="mini-kpi"><span>New Links</span><strong>${fmtNum(payload.backlinks.newCount)}</strong></div>
        <div class="mini-kpi"><span>Lost Links</span><strong>${fmtNum(payload.backlinks.lostCount)}</strong></div>
      </div>
      ${
        payload.backlinks.topSources.length > 0
          ? `<table><thead><tr><th>Referring Domain</th><th>Source URL</th><th>Status</th></tr></thead><tbody>${payload.backlinks.topSources
              .slice(0, 8)
              .map(
                (s) =>
                  `<tr><td>${escapeHtml(s.domain)}</td><td class="mono">${escapeHtml(s.url)}</td><td>${escapeHtml(s.status)}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : ''
      }`
    : '<p class="muted">Run Backlink Discovery to include referring domain metrics.</p>';

  const fixesHtml =
    payload.fixes && payload.fixes.length > 0
      ? `<table><thead><tr><th>Fix Applied</th><th>Target URL</th><th>Element</th><th>Status</th></tr></thead><tbody>${payload.fixes
          .slice(0, 15)
          .map(
            (f) =>
              `<tr><td>${escapeHtml(f.title)}</td><td class="mono">${escapeHtml(f.url)}</td><td>${escapeHtml(f.field)}</td><td>${escapeHtml(f.status)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="muted">No live verified website changes were recorded in this month.</p>';

  const prioritiesHtml =
    payload.nextMonthPriorities && payload.nextMonthPriorities.length > 0
      ? `<table><thead><tr><th>Priority Action</th><th>Source</th><th>Impact</th><th>Effort</th></tr></thead><tbody>${payload.nextMonthPriorities
          .slice(0, 5)
          .map(
            (p) =>
              `<tr><td><strong>${escapeHtml(p.title)}</strong>${p.roiNote ? `<div class="sub">${escapeHtml(p.roiNote)}</div>` : ''}</td><td>${escapeHtml(p.source)}</td><td>${escapeHtml(p.potential)}</td><td>${escapeHtml(p.effort)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="muted">No open prioritized recommendations remaining in Fix Engine.</p>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.domain)} — Monthly SEO Report (${escapeHtml(payload.monthLabel)})</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 0; font-size: 11px; line-height: 1.5; }
    .header { border-bottom: 3px solid ${accent}; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${accent}; }
    .logo { max-height: 36px; max-width: 160px; object-fit: contain; margin-bottom: 6px; display: block; }
    h1 { margin: 4px 0 2px; font-size: 22px; letter-spacing: -0.02em; }
    h2 { font-size: 13px; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; color: #111827; }
    .meta { color: #6b7280; font-size: 11px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px 10px; background: #f9fafb; }
    .kpi span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 600; }
    .kpi strong { display: block; font-size: 16px; margin-top: 2px; color: #111827; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; break-inside: avoid; }
    .card h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: ${accent}; }
    .card ul { margin: 0; padding-left: 16px; }
    .card li { margin-bottom: 4px; }
    .notes { border-left: 3px solid ${accent}; background: #f9fafb; padding: 10px 12px; border-radius: 4px; white-space: pre-wrap; margin-bottom: 14px; break-inside: avoid; }
    .mini-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
    .mini-kpi { border: 1px solid #e5e7eb; border-radius: 6px; padding: 7px 9px; }
    .mini-kpi span { display: block; font-size: 9px; color: #6b7280; text-transform: uppercase; }
    .mini-kpi strong { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; background: #f9fafb; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5px; word-break: break-all; }
    .sub { color: #059669; font-size: 9.5px; margin-top: 2px; }
    .muted { color: #6b7280; font-style: italic; margin: 4px 0; }
    .section { break-inside: avoid-page; margin-bottom: 14px; }
    footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9.5px; color: #6b7280; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="${brandTitle}" />` : ''}
      <div class="brand">${brandTitle} · Executive Monthly Report</div>
      <h1>${escapeHtml(payload.domain)}</h1>
      <div class="meta">${escapeHtml(payload.monthLabel)} · Generated ${escapeHtml(new Date(payload.generatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
    </div>
    ${wl?.enabled && wl.contactLine ? `<div class="meta">${escapeHtml(wl.contactLine)}</div>` : ''}
  </div>

  <div class="kpi-grid">
    ${kpiCards.map((c) => `<div class="kpi"><span>${escapeHtml(c.label)}</span><strong>${escapeHtml(c.value)}</strong></div>`).join('')}
  </div>

  ${
    payload.executiveSummary
      ? `<div class="summary-grid">
          <div class="card"><h3>Wins This Month</h3>${renderBullets(payload.executiveSummary.wins)}</div>
          <div class="card"><h3>Verified Work</h3>${renderBullets(payload.executiveSummary.workCompleted)}</div>
          <div class="card"><h3>Next Month Focus</h3>${renderBullets(payload.executiveSummary.nextMonthFocus)}</div>
        </div>`
      : ''
  }

  ${
    agencyNotes?.trim()
      ? `<div class="section"><h2>Account Manager Commentary</h2><div class="notes">${escapeHtml(agencyNotes.trim())}</div></div>`
      : ''
  }

  <div class="section">
    <h2>Top Search Keywords</h2>
    ${keywordsHtml}
  </div>

  <div class="section">
    <h2>Backlinks &amp; Authority Profile</h2>
    ${backlinksHtml}
  </div>

  <div class="section">
    <h2>Verified Website Changes &amp; Accountability</h2>
    ${fixesHtml}
  </div>

  <div class="section">
    <h2>Next Month&apos;s Top 5 Highest-ROI Priorities</h2>
    ${prioritiesHtml}
  </div>

  <footer>
    <span>${escapeHtml(wl?.enabled && wl.footerText ? wl.footerText : `${brandTitle} — Verified telemetry report. "—" means unmeasured, never zero.`)}</span>
    <span>${escapeHtml(payload.domain)} · ${escapeHtml(payload.month)}</span>
  </footer>
</body>
</html>`;
}
