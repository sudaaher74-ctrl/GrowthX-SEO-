import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NormalisedFinding } from './finding-adapter.interface';

const rows = (value: any): any[] => Array.isArray(value) ? value : [];
const text = (value: any): string => typeof value === 'string' ? value.trim() : '';
const level = (value: any): NormalisedFinding['potential'] =>
  ['HIGH', 'CRITICAL'].includes(text(value).toUpperCase()) ? 'HIGH' : text(value).toUpperCase() === 'LOW' ? 'LOW' : 'MEDIUM';

/** Copies saved recommendations; never generates new claims or spends model tokens. */
export async function collectReportPlans(prisma: PrismaService, projectId: string): Promise<NormalisedFinding[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
  if (!project) return [];
  const [audit, google, competitor, journey, saved] = await Promise.all([
    prisma.auditReportSnapshot.findFirst({ where: { projectId, report: { path: ['analysis'], not: Prisma.JsonNull } }, orderBy: { createdAt: 'desc' } }),
    prisma.googleReportSnapshot.findFirst({ where: { projectId, report: { path: ['analysis'], not: Prisma.JsonNull } }, orderBy: { createdAt: 'desc' } }),
    prisma.competitorReportSnapshot.findFirst({ where: { projectId, report: { path: ['analysis'], not: Prisma.JsonNull } }, orderBy: { createdAt: 'desc' } }),
    prisma.aiVisibilityJourney.findFirst({ where: { projectId, status: { in: ['COMPLETED', 'PARTIAL'] }, analysis: { not: Prisma.DbNull } }, orderBy: { createdAt: 'desc' } }),
    prisma.savedPlan.findMany({ where: { projectId, status: { not: 'EXECUTED' } } }),
  ]);
  const findings = new Map<string, NormalisedFinding>();
  const add = (source: NormalisedFinding['source'], item: any, ref: string, label: string) => {
    const title = text(item.title);
    const steps = rows(item.steps).map(text).filter(Boolean);
    if (!title || !steps.length) return;
    const fingerprint = `report-plan:${source}:${createHash('sha1').update(title.toLowerCase().replace(/\s+/g, ' ')).digest('hex').slice(0, 24)}`;
    const potential = level(item.priority);
    const evidence = [
      { label: 'Saved recommendation', value: label, source: label },
      ...(text(item.evidence) ? [{ label: 'Evidence', value: text(item.evidence), source: label }] : []),
      ...(rows(item.evidenceIds).length ? [{ label: 'Evidence IDs', value: rows(item.evidenceIds).join(', '), source: label }] : []),
      ...(text(item.measureBy) ? [{ label: 'Measure success', value: text(item.measureBy), source: label }] : []),
      ...(text(item.timeframe) ? [{ label: 'Timeframe', value: text(item.timeframe), source: label }] : []),
    ];
    const previous = findings.get(fingerprint);
    if (previous) {
      previous.evidence.push(...evidence);
      const combined = [...new Set([...previous.recommendedAction.split('\n').map(step => step.replace(/^\d+\.\s*/, '')), ...steps])];
      previous.recommendedAction = combined.map((step, i) => `${i + 1}. ${step}`).join('\n');
      return;
    }
    findings.set(fingerprint, {
      projectId, organizationId: project.organizationId, fingerprint, source,
      category: source === 'WEBSITE' ? 'TECHNICAL' : source === 'COMPETITOR' ? 'COMPETITOR' : 'MARKETING',
      title, summary: text(item.summary) || 'Recommendation from your saved report. Review its evidence before applying.',
      recommendedAction: steps.map((step, i) => `${i + 1}. ${step}`).join('\n'), evidence,
      potential, effort: level(item.effort), confidence: 70,
      impact: potential === 'HIGH' ? 80 : potential === 'LOW' ? 30 : 55,
      fixClass: 'MANUAL', affectedPages: text(item.url) ? [item.url] : [],
      affectedCount: typeof item.pages === 'number' ? item.pages : text(item.url) ? 1 : 0,
      detailType: 'REPORT_PLAN', detailRef: ref,
    });
  };
  const reports: Array<[NormalisedFinding['source'], any, string]> = [
    ['WEBSITE', audit, 'Website Audit report'], ['SEARCH_CONSOLE', google, 'Google report'], ['COMPETITOR', competitor, 'Competitor Intelligence report'],
  ];
  for (const [source, snapshot, label] of reports) {
    const analysis = snapshot?.report?.analysis;
    if (!analysis) continue;
    for (const item of rows(analysis.fixes)) add(source, { ...item, summary: item.whatIsWrong }, snapshot.id, label);
    for (const item of rows(analysis.priorities)) add(source, { ...item, summary: item.whyItMatters }, snapshot.id, label);
    for (const item of rows(analysis.gaps)) add(source, { ...item, summary: item.whyItHelpsThemRank, steps: item.howToBeatIt }, snapshot.id, label);
    for (const week of rows(analysis.plan)) for (const action of rows(week.actions)) add(source, { title: text(action), steps: [text(action)], timeframe: week.week }, snapshot.id, label);
    for (const action of rows(analysis.quickWins)) add(source, { title: text(action), steps: [text(action)], effort: 'LOW', timeframe: 'Quick win' }, snapshot.id, label);
    for (const channel of rows(analysis.marketingStrategy?.channels)) for (const action of rows(channel.actions)) add('ANALYTICS', { title: text(action), steps: [text(action)], evidence: channel.whatWeSee, summary: channel.strategy }, snapshot.id, label);
  }
  for (const assessment of rows(journey?.analysis)) for (const action of rows(assessment.actions)) add('MARKET', { ...action, summary: assessment.summary, evidence: `${assessment.provider} · ${assessment.model}` }, journey!.id, 'AI Visibility action plan');
  for (const plan of saved) {
    const name = plan.source.toLowerCase();
    const source = name.includes('competitor') ? 'COMPETITOR' : name.includes('google') || name.includes('search') || name.includes('analytics') ? 'SEARCH_CONSOLE' : name.includes('visibility') || name.includes('ai') ? 'MARKET' : 'WEBSITE';
    add(source, { title: plan.title, steps: [plan.deliverable], evidence: plan.evidence, url: plan.affectedUrl, summary: plan.impact, priority: plan.priority }, plan.id, 'Saved plan');
  }
  return [...findings.values()];
}
