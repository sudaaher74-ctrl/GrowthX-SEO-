import type { AvAction, TrackedCompetitor, VisibilityReport } from '@/lib/api-types';
import type { AvPrompt } from './av-shared';
import { modelKeyOf } from './av-shared';
export interface LiveDashboardData {
  report?: VisibilityReport | null;
  prompts?: AvPrompt[];
  citations?: { totalCitations: number; citationsByDomain: { domain: string; count: number; ownCited: boolean }[] } | null;
  rootCause?: { rivalsWinning: { brand: string; wins: number }[]; missedPrompts: { prompt: string; category: string; winner: string }[] } | null;
  actions?: AvAction[];
  competitors?: TrackedCompetitor[];
}
export const platformKey = (provider: string) => { const key = modelKeyOf(provider); return key === 'gpt' ? 'openai' : key; };
export function savedAnswers(prompts: AvPrompt[] = []) {
  return prompts.flatMap(p => (p.latestChecks ?? []).filter(c => !c.error && c.answerExcerpt).map(c => ({ ...c, question: p.text, platform: platformKey(c.assistant) }))).sort((a,b) => b.checkedAt.localeCompare(a.checkedAt));
}
export const recordedDate = (value?: string) => value ? new Date(value).toLocaleString() : 'Not measured yet';
export function NoMeasurement({ children = 'Not measured yet. Run monitoring to collect real evidence.' }: { children?: React.ReactNode }) { return <p className="py-4 text-xs text-brand-500">{children}</p>; }
