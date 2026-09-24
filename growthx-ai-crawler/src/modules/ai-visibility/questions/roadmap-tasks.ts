import type { IssueGroup } from '../../issues/issue-group.service';
import type { QuestionAnalysis } from './question-analysis.service';

/**
 * AI Visibility findings in the SEO Roadmap's own shape, one per buyer
 * question the latest answer did not cite the customer for.
 *
 * Only measured misses become tasks: a question never asked, or one that only
 * failed, has no evidence behind it yet. Reputation questions are left out —
 * an answer about the brand that names the brand is not a gap.
 *
 * Priority is a stated rule, not a measurement: a miss where the answer named
 * a rival instead outranks one where it named no one, and having no page at
 * all outranks having a page that needs work.
 */
export function roadmapTasks(questions: QuestionAnalysis[]): IssueGroup[] {
  const tasks: IssueGroup[] = [];

  for (const q of questions) {
    if (q.group !== 'BUYER' || q.outcome !== 'NOT_CITED' || !q.answer) continue;

    const rivals = q.answer.competitorsCited;
    const rivalNamed = rivals.length > 0;
    const gap = !q.ownPage;
    const assistant = assistantLabel(q.answer.assistant);
    const ahead = q.comparison.filter((c) => c.rivalAhead);

    const why = rivalNamed
      ? `${assistant} was asked "${q.text}" and named ${rivals.join(', ')}, not you.`
      : `${assistant} was asked "${q.text}" and did not name you.`;

    let action: string;
    let title: string;
    if (gap) {
      title = `Create a page that answers "${q.text}"`;
      action =
        'No page on your site covers this question. Publish one that answers it in the first paragraph, ' +
        'with an FAQ and structured data.';
    } else {
      title = `Strengthen ${pathOf(q.ownPage!.url)} to answer "${q.text}"`;
      const steps: string[] = [];
      for (const c of ahead) {
        if (c.signal === 'DIRECT_ANSWER') steps.push('add a short direct answer near the top');
        if (c.signal === 'FAQ') steps.push('add an FAQ section with FAQPage markup');
        if (c.signal === 'SCHEMA') steps.push('add structured data');
        if (c.signal === 'TERM_COVERAGE' && q.ownPage!.signals.missingTerms.length > 0) {
          steps.push(`cover the terms ${q.ownPage!.signals.missingTerms.map((t) => `"${t}"`).join(', ')}`);
        }
      }
      if (!q.ownPage!.signals.directAnswer && !steps.some((s) => s.includes('direct answer'))) {
        steps.push('add a short direct answer near the top');
      }
      if (q.ownPage!.issues.length > 0) {
        steps.push(`fix the audit issues on it (${q.ownPage!.issues.map((i) => i.issueType).join(', ')})`);
      }
      action = steps.length
        ? `On this page: ${[...new Set(steps)].join('; ')}.`
        : 'Rework this page so its opening paragraph answers the question directly.';
    }

    const evidence = ahead.length
      ? ` Where ${[...new Set(ahead.map((c) => c.rivalDomain))].join(', ')} is ahead: ${[
          ...new Set(ahead.map((c) => c.label.toLowerCase())),
        ].join(', ')}.`
      : '';

    tasks.push({
      groupKey: `aivis::${q.id}`,
      issueType: gap ? 'AI_VISIBILITY_CONTENT_GAP' : 'AI_VISIBILITY_PAGE_GAP',
      category: 'AI_VISIBILITY',
      severity: rivalNamed ? 'HIGH' : 'MEDIUM',
      // One assistant's answer on one day: a strong lead, not a certainty.
      confidence: 'LIKELY',
      affectedCount: gap ? 0 : 1,
      sampleUrls: gap ? [] : [q.ownPage!.url],
      aiFixAvailable: false,
      fixClass: 'MANUAL',
      impact: (rivalNamed ? 60 : 40) + (gap ? 15 : 5),
      reachAvailable: false,
      firstDetectedAt: new Date(q.answer.checkedAt).toISOString(),
      regressionCount: 0,
      title,
      summary: why + evidence,
      action,
    });
  }

  return tasks.sort((a, b) => b.impact - a.impact);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

function assistantLabel(assistant: string): string {
  const labels: Record<string, string> = { SARVAM: 'Sarvam', CHATGPT: 'ChatGPT', CLAUDE: 'Claude', GEMINI: 'Gemini' };
  return labels[assistant] ?? assistant;
}
