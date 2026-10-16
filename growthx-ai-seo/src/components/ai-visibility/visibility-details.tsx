"use client";

import { VisibilityDialog } from "./visibility-dialog";
import { savedAnswers, type LiveDashboardData } from "./live-dashboard-data";
import { NoMeasurement } from "./live-dashboard-data";

export function VisibilityDetails({ kind, model, checkedAt, onClose, ...data }: LiveDashboardData & {
  kind: "sources" | "response" | "competitors" | "evidence";
  model?: string; checkedAt?: string; onClose: () => void;
}) {
  const answers = savedAnswers(data.prompts).filter(a => (!model || a.platform === model) && (!checkedAt || a.checkedAt === checkedAt));
  const titles = { sources: "Recorded citation sources", response: "Saved AI response", competitors: "Competitor evidence", evidence: "Recorded evidence" };
  return <VisibilityDialog title={titles[kind]} onClose={onClose}>
    {kind === "sources" && <div className="space-y-3">
      {data.citations?.citationsByDomain.length ? data.citations.citationsByDomain.map(source => <div key={source.domain} className="flex justify-between border-b py-2 text-sm"><span>{source.domain}</span><span>{source.count} citations</span></div>) : <NoMeasurement>No recorded source links in the selected period.</NoMeasurement>}
    </div>}
    {kind === "response" && <div className="space-y-5">
      {answers.length ? answers.map((answer, index) => <article key={`${answer.question}-${answer.assistant}-${index}`} className="space-y-2 border-b pb-4">
        <p className="text-xs text-brand-500">{answer.assistant} · {answer.model} · {new Date(answer.checkedAt).toLocaleString()}</p>
        <h3 className="text-sm font-semibold">{answer.question}</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer.fullAnswer ?? answer.answerExcerpt}</p>
        {!answer.fullAnswer && <p className="text-xs text-brand-500">Only an excerpt is available for this older saved response.</p>}
      </article>) : <NoMeasurement>No saved response for this model in the selected period. Run a monitoring cycle to collect one.</NoMeasurement>}
    </div>}
    {kind === "competitors" && <div className="space-y-4">
      {data.competitors?.length ? data.competitors.map(competitor => <article key={competitor.id} className="border-b pb-3"><h3 className="text-sm font-semibold">{competitor.label || competitor.name || competitor.domain}</h3><p className="text-xs text-brand-500">{competitor.domain} · {competitor.lastAnalyzedAt ? `Analysed ${new Date(competitor.lastAnalyzedAt).toLocaleString()}` : "No completed analysis yet"}</p></article>) : <NoMeasurement>No tracked competitors for this project.</NoMeasurement>}
      {(data.rootCause?.rivalsWinning ?? []).map(rival => <p key={rival.brand} className="text-sm">{rival.brand}: {rival.wins} recorded wins</p>)}
    </div>}
    {kind === "evidence" && <div className="space-y-4">
      {data.rootCause?.missedPrompts.length ? data.rootCause.missedPrompts.map((item, index) => <article key={index} className="border-b pb-3"><h3 className="text-sm font-semibold">{item.prompt}</h3><p className="text-xs text-brand-500">{item.category} · Recorded winner: {item.winner}</p></article>) : <NoMeasurement>No evidence-backed diagnosis has been recorded in this period.</NoMeasurement>}
    </div>}
  </VisibilityDialog>;
}
