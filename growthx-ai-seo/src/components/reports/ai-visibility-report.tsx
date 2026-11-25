"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, PenLine } from "lucide-react";
import {
  ReportGap,
  ReportKpis,
  ReportLoading,
  ReportPage,
  ReportSection,
  ReportTable,
  ReportText,
  useReportContext,
} from "@/components/reports/report-kit";
import { ImplementationHandoffPanel } from "@/components/reports/implementation-handoff-panel";
import { BusinessContextStrip, ReportPlaybookSections } from "@/components/reports/report-playbook-sections";
import { AiVisibilityCharts } from "@/components/ai-visibility/ai-visibility-charts";
import { businessContextToMarkdown, playbookToMarkdown } from "@/lib/report-playbook-markdown";
import { Pill } from "@/components/ui/console";
import { useVisibility } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { assistantLabel, assistantList } from "@/lib/ai-assistants";
import { download } from "@/lib/competitor-report";
import { DASH, count } from "@/lib/google-format";
import {
  buildAiVisibilityImplementationSpecs,
  formatSpecAsMarkdown,
} from "@/lib/implementation-specs";
import { downloadCsvFile } from "@/lib/report-csv";

/**
 * Executive + Implementation-Ready AI Visibility Report:
 * Measures real brand citations across ChatGPT, Claude, Gemini, Perplexity & Sarvam,
 * compares Share of Voice against rivals, audits every buyer question's page signals,
 * and delivers a universal AI-Readiness Handoff Kit (/llms.txt, robots.txt, FAQPage JSON-LD).
 */
export function AiVisibilityReport() {
  const { projectId, clientName, domain } = useReportContext();
  const visibility = useVisibility(projectId);

  const insights = useQuery({
    queryKey: ["visibility-insights", projectId],
    queryFn: () => api.getVisibilityInsights(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const questionAnalysis = useQuery({
    queryKey: ["visibility-question-analysis-report", projectId],
    queryFn: () => api.getQuestionAnalysis(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });

  if (!projectId || visibility.isLoading) return <ReportLoading what="the AI Visibility report" />;

  const v = visibility.data;
  const ins = insights.data;
  const qa = questionAnalysis.data;

  const asked = assistantList(
    v?.byAssistant?.length
      ? v.byAssistant.map((a) => assistantLabel(a.assistant, a.model))
      : v?.measurableAssistants,
  );
  const pct = (n: number | null | undefined) => (n == null ? DASH : `${Math.round(n * 10) / 10}%`);

  const specs = buildAiVisibilityImplementationSpecs({
    visibility: v,
    insights: ins,
    questionAnalysis: qa,
    domain,
    clientName,
  });

  const questions = qa?.questions ?? [];
  const missedCount = questions.filter((q) => q.outcome === "NOT_CITED").length;
  const citedCount = questions.filter((q) => q.outcome === "CITED").length;

  const handleDownloadCsv = () => {
    downloadCsvFile(`${domain || "website"}-ai-visibility-report.csv`, [
      {
        title: "By Assistant",
        headers: ["Assistant", "Checked", "Cited", "Citation Share %"],
        rows: (v?.byAssistant ?? []).map((a) => [
          assistantLabel(a.assistant, a.model),
          a.checked,
          a.cited,
          a.citationSharePct,
        ]),
      },
      {
        title: "Competitor Share of Voice",
        headers: ["Brand", "Mentions", "Share %"],
        rows: (v?.shareOfVoice ?? []).map((s) => [s.label, s.mentions, s.sharePct]),
      },
      {
        title: "Question-by-Question Citation Audit",
        headers: ["Buyer Question", "Outcome", "Rivals Cited", "Matched Page", "Missing Signals"],
        rows: questions.map((q) => [
          q.text,
          q.outcome,
          (q.answer?.competitorsCited ?? []).join(" | "),
          q.ownPage?.url ?? "No matching page",
          q.comparison
            .filter((c) => c.rivalAhead)
            .map((c) => `${c.label}: you=${c.you} vs ${c.rivalDomain}=${c.rival}`)
            .join(" | "),
        ]),
      },
      {
        title: "Recommendations",
        headers: ["Recommendation", "Category", "Priority", "Effort", "Rationale"],
        rows: (ins?.recommendations ?? []).map((r) => [r.title, r.category, r.priority, r.effort, r.rationale]),
      },
    ]);
  };

  const handleDownloadMarkdown = () => {
    const lines: string[] = [
      `# AI Visibility & Citation Intelligence Report${domain ? `: ${domain}` : ""}`,
      "",
      `Client: ${clientName} · Generated ${new Date().toISOString().slice(0, 10)}${asked ? ` · Assistants measured: ${asked}` : ""}`,
      "",
    ];
    if (v && v.summary.checked > 0) {
      lines.push(
        "## Executive Scorecard",
        "",
        `- **Answers Checked:** ${v.summary.checked}`,
        `- **Named You:** ${v.summary.cited}`,
        `- **Citation Share:** ${pct(v.summary.citationSharePct)}`,
        `- **Average Position:** ${v.summary.averagePosition == null ? "not measured" : v.summary.averagePosition.toFixed(1)}`,
        "",
        "## By Assistant",
        "",
        "| Assistant / Model | Checked | Cited | Citation Share |",
        "| --- | --- | --- | --- |",
        ...v.byAssistant.map(
          (a) => `| ${assistantLabel(a.assistant, a.model)} | ${a.checked} | ${a.cited} | ${pct(a.citationSharePct)} |`,
        ),
        "",
      );
      if (v.shareOfVoice.length > 0) {
        lines.push(
          "## Competitor Share of Voice",
          "",
          "| Brand | Mentions | Share |",
          "| --- | --- | --- |",
          ...v.shareOfVoice.map((s) => `| ${s.label} | ${s.mentions} | ${pct(s.sharePct)} |`),
          "",
        );
      }
    }
    if (questions.length > 0) {
      lines.push("## Question-by-Question Citation Audit", "");
      for (const q of questions.slice(0, 25)) {
        const rivals = q.answer?.competitorsCited?.length ? ` · Rivals cited: ${q.answer.competitorsCited.join(", ")}` : "";
        const gaps = q.comparison
          .filter((c) => c.rivalAhead)
          .map((c) => `${c.label} (${c.you} vs ${c.rival})`)
          .join("; ");
        lines.push(
          `- **[${q.outcome}]** ${q.text}${rivals}${q.ownPage?.url ? ` · Page: ${q.ownPage.url}` : " · No matching page"}${gaps ? ` · Gaps: ${gaps}` : ""}`,
        );
      }
      lines.push("");
    }
    if (ins && ins.status === "READY") {
      lines.push(...businessContextToMarkdown(ins.businessContext), "");
      lines.push("## Strategic Analysis", "");
      if (ins.summary) lines.push(ins.summary, "");
      if (ins.findings.length > 0) {
        lines.push(...ins.findings.map((f) => `- **${f.title}:** ${f.detail} (${f.evidence})`), "");
      }
      if (ins.playbook) {
        lines.push(...playbookToMarkdown(ins.playbook), "");
      }
    }
    if (specs.length > 0) {
      lines.push("## Universal AI-Readiness Implementation & Developer Handoff Guide", "");
      specs.forEach((s) => lines.push(formatSpecAsMarkdown(s), ""));
    }
    download(
      `ai-visibility-report-${domain || "website"}-${new Date().toISOString().slice(0, 10)}.md`,
      lines.join("\n"),
      "text/markdown",
    );
  };

  return (
    <ReportPage
      title="AI Visibility & Citation Intelligence Report"
      clientName={clientName}
      domain={domain}
      intro="Whether ChatGPT, Claude, Gemini, Perplexity, and Sarvam recommend your business when buyers ask purchase questions — paired with a question-by-question signal audit and universal AI-readiness implementation pack (/llms.txt, robots.txt, and FAQPage JSON-LD)."
      onDownloadMarkdown={handleDownloadMarkdown}
      onDownloadCsv={handleDownloadCsv}
    >
      {!v || v.summary.checked === 0 ? (
        <ReportSection title="At a glance">
          <ReportGap>
            No AI assistant has been asked about your business yet, so there is nothing to report. Run a check on the AI Visibility tab first.
          </ReportGap>
        </ReportSection>
      ) : (
        <>
          {/* 1. Executive Scorecard */}
          <ReportSection title="Executive scorecard" note={`Assistants measured: ${asked}.`}>
            <ReportKpis
              items={[
                { label: "Answers checked", value: count(v.summary.checked) },
                { label: "Named you", value: count(v.summary.cited) },
                {
                  label: "Citation share",
                  value: pct(v.summary.citationSharePct),
                  sub:
                    v.summary.deltaPt == null
                      ? undefined
                      : `${v.summary.deltaPt >= 0 ? "+" : "−"}${Math.abs(v.summary.deltaPt)} pts vs prior`,
                },
                {
                  label: "Average position",
                  value: v.summary.averagePosition == null ? DASH : `#${v.summary.averagePosition.toFixed(1)}`,
                },
              ]}
            />

            {/* Funnel + Sentiment + Geo Row */}
            {(v.customerJourney || v.brandPerception || v.locationSupport) && (
              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-3 text-[12px]">
                {v.customerJourney && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      Buyer Journey Funnel
                    </p>
                    <p className="mt-1 text-brand-950 font-semibold">
                      Discovery: {pct(v.customerJourney.discovery.citationSharePct)}{" "}
                      <span className="font-normal text-brand-500">
                        ({v.customerJourney.discovery.cited}/{v.customerJourney.discovery.checked})
                      </span>
                    </p>
                    <p className="mt-0.5 text-brand-950 font-semibold">
                      Recommendation: {pct(v.customerJourney.recommendation.citationSharePct)}{" "}
                      <span className="font-normal text-brand-500">
                        ({v.customerJourney.recommendation.cited}/{v.customerJourney.recommendation.checked})
                      </span>
                    </p>
                  </div>
                )}

                {v.brandPerception && v.brandPerception.total > 0 && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      Brand Sentiment ({v.brandPerception.total} mentions)
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill tone="good">Positive: {v.brandPerception.positive}</Pill>
                      <Pill tone="default">Neutral: {v.brandPerception.neutral}</Pill>
                      {v.brandPerception.negative > 0 && (
                        <Pill tone="bad">Negative: {v.brandPerception.negative}</Pill>
                      )}
                    </div>
                  </div>
                )}

                {v.locationSupport && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      Geo-Targeting Scope
                    </p>
                    <p className="mt-1 font-semibold text-brand-950">
                      {[v.locationSupport.targetCity, v.locationSupport.targetCountry].filter(Boolean).join(", ")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-500">
                      {v.locationSupport.engines.filter((e) => e.locationSupported).length} of{" "}
                      {v.locationSupport.engines.length} engines support local context
                    </p>
                  </div>
                )}
              </div>
            )}
          </ReportSection>

          {/* Visual Executive Charts: Share of Voice Donut + 5-Engine Bar + Buyer Journey Funnel */}
          {(v.byAssistant.length > 0 || v.shareOfVoice.length > 0) && (
            <AiVisibilityCharts
              assistants={v.byAssistant.map((a) => ({
                name: assistantLabel(a.assistant, a.model),
                checked: a.checked,
                cited: a.cited,
                citationSharePct: a.citationSharePct,
              }))}
              shareOfVoice={v.shareOfVoice.map((s) => ({
                label: s.label,
                mentions: s.mentions,
                sharePct: s.sharePct,
                domain: s.domain,
              }))}
              funnel={v.customerJourney ?? null}
              yourBrandLabel={clientName || domain}
            />
          )}

          {/* 2. By Assistant */}
          <ReportSection title="Citation share by AI assistant">
            <ReportTable
              columns={[
                { label: "Assistant / Model" },
                { label: "Answers checked", right: true },
                { label: "Named you", right: true },
                { label: "Citation share", right: true },
              ]}
              rows={v.byAssistant.map((a) => [
                assistantLabel(a.assistant, a.model),
                count(a.checked),
                count(a.cited),
                pct(a.citationSharePct),
              ])}
              empty="No assistant has been asked."
            />
          </ReportSection>

          {/* 3. Competitor Share of Voice */}
          <ReportSection
            title="Competitor share of voice in AI answers"
            note="Percentage of all brand mentions across measured AI answers."
          >
            {v.shareOfVoice.length === 0 ? (
              <p className="text-[12px] text-brand-500">No competitor was mentioned.</p>
            ) : (
              <div className="space-y-2">
                {v.shareOfVoice.slice(0, 10).map((s) => (
                  <div key={s.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-brand-950">
                        {s.label}
                        {s.domain ? <span className="ml-1.5 font-mono text-[11px] text-brand-400">{s.domain}</span> : null}
                      </span>
                      <span className="font-mono text-brand-700">
                        {count(s.mentions)} mentions · {pct(s.sharePct)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-600"
                        style={{ width: `${Math.min(100, Math.max(2, s.sharePct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportSection>
        </>
      )}

      {/* 4. Question-by-Question Citation & Signal Gap Audit */}
      {questions.length > 0 && (
        <ReportSection
          title={`Question-by-Question Citation & Signal Audit (${citedCount} cited · ${missedCount} missed)`}
          note="Each tracked buyer question joined with your crawled pages and competitor citation signals — showing exactly why rivals win answers you miss."
        >
          <div className="space-y-2.5">
            {questions.slice(0, 15).map((q) => {
              const rivalGaps = q.comparison.filter((c) => c.rivalAhead);
              return (
                <div
                  key={q.id}
                  className="print-avoid-break rounded-xl border border-brand-200 p-3.5 space-y-1.5 text-[12px]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill
                      tone={
                        q.outcome === "CITED"
                          ? "good"
                          : q.outcome === "NOT_CITED"
                            ? "bad"
                            : "default"
                      }
                    >
                      {q.outcome === "CITED"
                        ? "Cited"
                        : q.outcome === "NOT_CITED"
                          ? "Missed"
                          : q.outcome === "FAILED"
                            ? "Check failed"
                            : "Not measured"}
                    </Pill>
                    <p className="font-bold text-brand-950 flex-1 min-w-[200px]">{q.text}</p>
                    {q.outcome === "NOT_CITED" && (
                      <Link
                        href={`/fix-engine?tab=content&query=${encodeURIComponent(q.text)}&topic=${encodeURIComponent(`AI Citation Answer Page: ${q.text}`)}&kind=ARTICLE`}
                        className="no-print inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-950"
                      >
                        <PenLine size={11} />
                        <span>Draft in Content Studio</span>
                      </Link>
                    )}
                  </div>

                  {q.answer?.competitorsCited && q.answer.competitorsCited.length > 0 && (
                    <p className="text-[11.5px] text-brand-600">
                      <span className="font-semibold text-brand-950">Rivals cited instead: </span>
                      {q.answer.competitorsCited.join(", ")}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-brand-500">
                    <span>
                      <strong className="text-brand-800">Your page: </strong>
                      {q.ownPage?.url ? (
                        <a
                          href={q.ownPage.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-accent-700 hover:underline"
                        >
                          {q.ownPage.url}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        "No dedicated page detected (content gap)"
                      )}
                    </span>
                    {q.ownPage && (
                      <span>
                        Words: <strong className="font-mono text-brand-800">{q.ownPage.signals.wordCount}</strong> ·
                        FAQ: <strong className="text-brand-800">{q.ownPage.signals.faq ? "Yes" : "Missing"}</strong> ·
                        Direct answer: <strong className="text-brand-800">{q.ownPage.signals.directAnswer ? "Yes" : "Missing"}</strong>
                      </span>
                    )}
                  </div>

                  {rivalGaps.length > 0 && (
                    <p className="text-[11.5px] text-warning-700">
                      <span className="font-semibold">Where rivals are ahead: </span>
                      {rivalGaps
                        .map((g) => `${g.label} (you: ${g.you} vs ${g.rivalDomain}: ${g.rival})`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ReportSection>
      )}

      {/* 5. Strategic Analysis & Recommendations */}
      <ReportSection title="Strategic analysis & priorities">
        {!ins || ins.status !== "READY" ? (
          <ReportGap>
            The strategic summary has not been generated yet. Run an AI Visibility analysis to populate tailored findings alongside the universal implementation pack below.
          </ReportGap>
        ) : (
          <div className="space-y-3">
            {ins.summary && <ReportText>{ins.summary}</ReportText>}
            {ins.findings.length > 0 && (
              <ul className="space-y-1.5">
                {ins.findings.map((f) => (
                  <li key={f.title}>
                    <ReportText>
                      <strong>{f.title}.</strong> {f.detail}{" "}
                      <span className="text-brand-400">({f.evidence})</span>
                    </ReportText>
                  </li>
                ))}
              </ul>
            )}
            <ReportTable
              columns={[{ label: "Recommendation" }, { label: "Impact" }, { label: "Effort" }, { label: "Why" }]}
              rows={ins.recommendations.map((r) => [
                r.title,
                r.priority.toLowerCase(),
                r.effort.toLowerCase(),
                r.rationale,
              ])}
              empty="No recommendations."
            />
          </div>
        )}
      </ReportSection>

      {ins?.businessContext && <BusinessContextStrip ctx={ins.businessContext} />}

      {ins?.playbook && <ReportPlaybookSections playbook={ins.playbook} />}

      {/* 6. Universal AI-Readiness Implementation Handoff Pack */}
      <ImplementationHandoffPanel
        reportTitle="AI Visibility"
        domain={domain}
        projectId={projectId}
        specs={specs}
        filenameSlug="ai-visibility"
        subtitle="Ready-to-deploy /llms.txt, robots.txt AI crawler allowlist, and FAQPage JSON-LD / Direct-Answer briefs — usable by any developer or editor on any platform."
      />
    </ReportPage>
  );
}
