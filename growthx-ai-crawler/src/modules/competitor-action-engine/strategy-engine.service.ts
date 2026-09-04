import { Injectable, Logger } from '@nestjs/common';
import { ActionPriority, FindingCategory, FindingConfidence } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FindingsCollectorService } from './findings-collector.service';
import { BusinessGoal, scoreOpportunity, suggestedOwner } from './opportunity-scoring';

/** A finding as the planner reads it. */
export interface PlannerFinding {
  id: string;
  competitorId: string | null;
  category: FindingCategory;
  summary: string;
  detail: string;
  metricValue: number | null;
  customerValue: number | null;
  confidence: FindingConfidence;
}

/** One action before it is scored and written. */
export interface DraftAction {
  category: FindingCategory;
  title: string;
  steps: string[];
  rationale: string;
  expectedImpact: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  effortHours: number;
  findingIds: string[];
  competitorsWithEvidence: number;
  confidence: FindingConfidence;
}

/** How far out each priority's due date is set, in days. */
const DUE_IN_DAYS: Record<ActionPriority, number> = {
  CRITICAL: 7,
  HIGH: 14,
  MEDIUM: 21,
  LOW: 30,
};

/**
 * Turns evidence into a plan someone can work through.
 *
 * Actions are derived deterministically from findings rather than generated.
 * A model asked for "a 30-day plan" will produce a confident, plausible, and
 * partly invented one; every action here traces to a finding that traces to a
 * crawled page or an API response, and an action with no evidence behind it is
 * not written at all.
 *
 * That constraint is also what keeps the advice original. The engine reads
 * *what* competitors do — that they run city pages, that they publish weekly —
 * and writes its own brief for doing it better. It never copies their titles,
 * their copy, or their scripts, because it never reads them for that purpose.
 */
@Injectable()
export class StrategyEngineService {
  private readonly logger = new Logger(StrategyEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: FindingsCollectorService,
  ) {}

  /**
   * Collects fresh evidence, then writes a plan from it.
   *
   * The run row is created first and finished last, so a crash leaves a FAILED
   * run with its error rather than a silent absence the operator has to guess
   * about.
   */
  async generate(organizationId: string, projectId: string): Promise<{ runId: string; status: string }> {
    const running = await this.prisma.strategyRun.findFirst({
      where: { projectId, status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true },
    });
    // Two runs writing findings for one project would race on the replace, and
    // the second would win by accident rather than by being newer.
    if (running) return { runId: running.id, status: running.status };

    const profile = await this.prisma.projectBusinessProfile.findUnique({
      where: { projectId },
      select: { businessGoal: true },
    });
    const goal = normalizeGoal(profile?.businessGoal);

    const run = await this.prisma.strategyRun.create({
      data: { organizationId, projectId, status: 'RUNNING', businessGoal: goal ?? null, coverageGaps: [] },
    });

    // Returned before the work is done, deliberately.
    //
    // The run reads stored crawl and API output rather than fetching anything,
    // so it takes seconds — but seconds is still long enough that holding the
    // request open makes the button feel broken. The row tracks its own status,
    // which is what lets the page show progress and survive a reload; a
    // distributed queue would add a hop and a failure mode to run a handful of
    // database queries. If this ever grows network calls, the run row is
    // already the right shape to hand to the existing BullMQ queue.
    void this.execute(run.id, organizationId, projectId, goal).catch((err) => {
      this.logger.error(`Strategy run ${run.id} failed outside its own handler: ${err?.message ?? err}`);
    });

    return { runId: run.id, status: 'RUNNING' };
  }

  /** The run itself. Never throws to the caller; failure is recorded on the row. */
  private async execute(
    runId: string,
    organizationId: string,
    projectId: string,
    goal: BusinessGoal | null,
  ): Promise<void> {
    const run = { id: runId };

    try {
      const { coverageGaps } = await this.collector.collect(organizationId, projectId);

      const findings = await this.prisma.competitorFinding.findMany({
        where: { projectId },
        select: {
          id: true,
          competitorId: true,
          category: true,
          summary: true,
          detail: true,
          metricValue: true,
          customerValue: true,
          confidence: true,
        },
      });

      const drafts = planActions(findings);
      let written = 0;

      for (const draft of drafts) {
        const { score, priority, explanation } = scoreOpportunity({
          category: draft.category,
          impact: draft.impact,
          effortHours: draft.effortHours,
          competitorsWithEvidence: draft.competitorsWithEvidence,
          confidence: draft.confidence,
          businessGoal: goal,
        });

        await this.prisma.strategyAction.create({
          data: {
            organizationId,
            projectId,
            runId: run.id,
            category: draft.category,
            title: draft.title,
            steps: draft.steps,
            rationale: draft.rationale,
            expectedImpact: draft.expectedImpact,
            effortHours: draft.effortHours,
            priority,
            owner: suggestedOwner(draft.category),
            opportunityScore: score,
            scoreExplanation: explanation,
            dueDate: dueDateFor(priority),
            findings: { connect: draft.findingIds.map((id) => ({ id })) },
          },
        });
        written++;
      }

      await this.prisma.strategyRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          findingsUsed: findings.length,
          coverageGaps,
          finishedAt: new Date(),
        },
      });

      this.logger.log(`Strategy run ${run.id} wrote ${written} action(s) from ${findings.length} finding(s).`);
    } catch (err: any) {
      await this.prisma.strategyRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', error: err?.message ?? String(err), finishedAt: new Date() },
      });
      this.logger.error(`Strategy run failed for project ${projectId}: ${err?.message ?? err}`);
    }
  }

  /** Where a run has got to, for a page that started one and is waiting. */
  async runStatus(projectId: string): Promise<{
    status: string;
    runId: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    error: string | null;
  }> {
    const run = await this.prisma.strategyRun.findFirst({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, startedAt: true, finishedAt: true, error: true },
    });

    if (!run) return { status: 'NONE', runId: null, startedAt: null, finishedAt: null, error: null };
    return {
      status: run.status,
      runId: run.id,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      error: run.error,
    };
  }
}

/**
 * The plan itself: one action per thing worth doing, each carrying its evidence.
 *
 * Exported and pure so the mapping from evidence to advice can be tested
 * without a database — it is the part most likely to be argued with, and the
 * part where a quiet mistake would put a wrong instruction in front of a
 * customer.
 */
export function planActions(findings: PlannerFinding[]): DraftAction[] {
  const actions: DraftAction[] = [];
  const byCategory = groupBy(findings, (finding) => finding.category);

  for (const [category, group] of byCategory) {
    switch (category) {
      case 'TECHNICAL_SEO':
        actions.push(...technicalActions(group));
        break;
      case 'CONTENT_GAP':
      case 'LOCAL_SEO':
        actions.push(...coverageActions(group));
        break;
      case 'AI_SEARCH':
        actions.push(...aiSearchActions(group));
        break;
      case 'YOUTUBE':
        actions.push(...youtubeActions(group));
        break;
      case 'INSTAGRAM':
        actions.push(...instagramActions(group));
        break;
      case 'GOOGLE_BUSINESS_PROFILE':
        actions.push(...localActions(group));
        break;
      default:
        break;
    }
  }

  return actions;
}

function technicalActions(findings: PlannerFinding[]): DraftAction[] {
  return findings.map((finding) => {
    const count = finding.customerValue ?? 0;
    const isBroken = /returned an error/.test(finding.summary);
    const isMeta = /meta description/.test(finding.summary);
    const isNoindex = /not to index/.test(finding.summary);

    if (isNoindex) {
      return {
        category: 'TECHNICAL_SEO' as const,
        title: `Review ${count} page${count === 1 ? '' : 's'} marked noindex`,
        steps: [
          'List every page carrying a noindex directive.',
          'Separate the deliberate ones — thank-you pages, internal search results, duplicates — from the rest.',
          'For anything that should rank, remove the directive and request re-indexing in Search Console.',
          'Check your staging configuration, which is where an accidental sitewide noindex usually comes from.',
        ],
        rationale: finding.detail,
        expectedImpact:
          'A page marked noindex earns nothing from search no matter how good it is. If even one is a mistake, ' +
          'this is the cheapest traffic on the list.',
        // Cheap to check, and the downside of one wrong noindex is total.
        impact: 'HIGH' as const,
        effortHours: 2,
        findingIds: [finding.id],
        competitorsWithEvidence: 0,
        confidence: finding.confidence,
      };
    }

    return {
      category: 'TECHNICAL_SEO' as const,
      title: isBroken
        ? `Fix ${count} broken URL${count === 1 ? '' : 's'}`
        : isMeta
          ? `Write meta descriptions for ${count} page${count === 1 ? '' : 's'}`
          : `Add an H1 to ${count} page${count === 1 ? '' : 's'}`,
      steps: isBroken
        ? [
            'Export the failing URLs from the latest crawl.',
            'For each, decide: restore the page, redirect it to the closest live equivalent, or let it 410 if it should never return.',
            'Update any internal links still pointing at it, so the fix is not undone by the next crawl.',
            'Re-run the crawl to confirm the count has dropped.',
          ]
        : isMeta
          ? [
              'List the pages with no description, highest-traffic first.',
              'Write one sentence per page saying what the page offers and who it is for — not a keyword list.',
              'Keep each under about 155 characters so it is not truncated.',
              'Publish and re-crawl to confirm.',
            ]
          : [
              'List the pages with no H1.',
              'Add a single H1 naming the page subject in the words a customer would use.',
              'Check no page has more than one H1.',
              'Publish and re-crawl to confirm.',
            ],
      rationale: finding.detail,
      expectedImpact: isBroken
        ? 'Recovers crawl budget and any authority pointing at the broken URLs.'
        : 'Improves how the page is presented in results, which lifts click-through without needing a ranking change.',
      // A handful is housekeeping; a large count is a real drag on the site.
      impact: count >= 10 ? 'HIGH' : count >= 3 ? 'MEDIUM' : 'LOW',
      effortHours: Math.min(20, Math.max(2, Math.ceil(count / 4))),
      findingIds: [finding.id],
      competitorsWithEvidence: 0,
      confidence: finding.confidence,
    };
  });
}

function coverageActions(findings: PlannerFinding[]): DraftAction[] {
  return findings.map((finding) => {
    const theirs = finding.metricValue ?? 0;
    const mine = finding.customerValue ?? 0;
    const isLocation = finding.category === 'LOCAL_SEO';
    const target = Math.min(3, Math.max(1, Math.ceil(theirs - mine)));

    return {
      category: finding.category,
      title: isLocation
        ? `Publish ${target} location page${target === 1 ? '' : 's'} for your main service areas`
        : `Publish ${target} new page${target === 1 ? '' : 's'} covering the gap`,
      steps: [
        isLocation
          ? 'Pick the service areas that actually bring you business, not every pin on the map.'
          : 'Pick the topics your customers ask about most before they buy.',
        'For each, write an original page: what you offer there, who it is for, proof you have done it, and what to do next.',
        'Answer the questions a buyer asks on the phone — those are the ones search has to answer too.',
        'Link it from your main navigation or service page so it is not an orphan.',
        'Add a clear call to action above the fold.',
      ],
      rationale: finding.detail,
      expectedImpact: isLocation
        ? 'Creates a page that can rank for "service + city" searches you currently have nothing to rank with.'
        : 'Covers buying-intent topics that currently send traffic to competitors instead.',
      impact: theirs - mine >= 3 ? 'HIGH' : 'MEDIUM',
      effortHours: target * 4,
      findingIds: [finding.id],
      // The finding's own summary distinguishes one rival ahead from several.
      competitorsWithEvidence: /(\d+) competitors/.test(finding.summary)
        ? Number(/(\d+) competitors/.exec(finding.summary)![1])
        : 1,
      confidence: finding.confidence,
    };
  });
}

function aiSearchActions(findings: PlannerFinding[]): DraftAction[] {
  return findings.map((finding) => ({
    category: 'AI_SEARCH' as const,
    title: 'Add structured data to your main service and location pages',
    steps: [
      'Start with the pages that answer a buying question — services, locations, FAQs.',
      'Add the schema type that matches what the page actually is: LocalBusiness, Service, Product or FAQPage.',
      'Fill in the fields you can evidence — name, address, area served, price range, opening hours.',
      'Validate each page in a structured data testing tool before publishing.',
    ],
    rationale: finding.detail,
    expectedImpact:
      'Lets search engines and AI assistants state what your pages are about instead of guessing, which is what ' +
      'makes a page quotable in an AI answer.',
    impact: 'MEDIUM' as const,
    effortHours: 6,
    findingIds: [finding.id],
    competitorsWithEvidence: 0,
    confidence: finding.confidence,
  }));
}

function youtubeActions(findings: PlannerFinding[]): DraftAction[] {
  if (findings.length === 0) return [];

  const cadences = findings.map((finding) => finding.metricValue ?? 0).filter((value) => value > 0);
  const busiest = cadences.length ? Math.max(...cadences) : 0;
  const suggested = Math.max(2, Math.min(8, Math.round(busiest)));

  return [
    {
      category: 'YOUTUBE' as const,
      title: `Publish ${suggested} short videos a month answering pre-purchase questions`,
      steps: [
        'List the ten questions customers ask you most before they buy.',
        'Film one short answer per question — one question, one video, under ninety seconds.',
        'Write your own title stating the question plainly; do not adapt a competitor title.',
        'Open with the answer, then explain. The first five seconds decide whether anyone stays.',
        'End by naming the single next step you want the viewer to take.',
      ],
      rationale: findings.map((finding) => finding.summary).join('; ') + '.',
      expectedImpact:
        'Builds a library that answers buying questions where your competitors are already answering them, and ' +
        'gives search and AI assistants your answer to quote.',
      impact: busiest >= 4 ? 'HIGH' : 'MEDIUM',
      effortHours: suggested * 2,
      findingIds: findings.map((finding) => finding.id),
      competitorsWithEvidence: findings.length,
      confidence: weakest(findings),
    },
  ];
}

function instagramActions(findings: PlannerFinding[]): DraftAction[] {
  if (findings.length === 0) return [];

  const cadences = findings.map((finding) => finding.metricValue ?? 0).filter((value) => value > 0);
  const busiest = cadences.length ? Math.max(...cadences) : 0;
  const suggested = Math.max(4, Math.min(20, Math.round(busiest)));

  return [
    {
      category: 'INSTAGRAM' as const,
      title: `Post ${suggested} times a month, built around one repeatable format`,
      steps: [
        'Pick one format you can sustain — a before-and-after, a delivery-day clip, a single customer question answered.',
        'Shoot a month of it in one session; consistency beats variety you cannot keep up.',
        'Write your own hook for each: the first line should name the problem, not the brand.',
        'Put the offer in the caption, not only the bio, so a saved post still converts.',
        'Review which format held attention after four weeks and drop the ones that did not.',
      ],
      rationale: findings.map((finding) => finding.summary).join('; ') + '.',
      expectedImpact:
        'Matches the publishing rhythm your competitors already sustain, on a format you can keep up without ' +
        'a studio.',
      impact: busiest >= 12 ? 'HIGH' : 'MEDIUM',
      // Batch shooting is why this is not one hour per post.
      effortHours: Math.max(4, Math.round(suggested / 2)),
      findingIds: findings.map((finding) => finding.id),
      competitorsWithEvidence: findings.length,
      confidence: weakest(findings),
    },
  ];
}

function localActions(findings: PlannerFinding[]): DraftAction[] {
  return findings.map((finding) => ({
    category: 'GOOGLE_BUSINESS_PROFILE' as const,
    title: 'Build a steady review flow from recent customers',
    steps: [
      'Ask every satisfied customer within a day of delivery, while it is still fresh.',
      'Send a direct link to the review form — every extra tap loses people.',
      'Reply to all reviews, including the critical ones; the reply is read by the next customer, not the last.',
      'Track the count weekly so a slow month is visible before it becomes a slow quarter.',
    ],
    rationale: finding.detail,
    expectedImpact: 'Rating and review volume are among the strongest local pack ranking signals.',
    impact: 'MEDIUM' as const,
    effortHours: 3,
    findingIds: [finding.id],
    competitorsWithEvidence: 0,
    confidence: finding.confidence,
  }));
}

/** The weakest confidence in a set: a claim is only as good as its worst input. */
function weakest(findings: PlannerFinding[]): FindingConfidence {
  if (findings.some((finding) => finding.confidence === 'LOW')) return 'LOW';
  if (findings.some((finding) => finding.confidence === 'MEDIUM')) return 'MEDIUM';
  return 'HIGH';
}

function dueDateFor(priority: ActionPriority): Date {
  const due = new Date();
  due.setDate(due.getDate() + DUE_IN_DAYS[priority]);
  return due;
}

function normalizeGoal(value?: string | null): BusinessGoal | null {
  const goals: BusinessGoal[] = ['LEADS', 'LOCAL_VISITS', 'ECOMMERCE_SALES', 'BRAND_AWARENESS', 'CONTENT_GROWTH'];
  const upper = (value ?? '').toUpperCase();
  return goals.includes(upper as BusinessGoal) ? (upper as BusinessGoal) : null;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}
