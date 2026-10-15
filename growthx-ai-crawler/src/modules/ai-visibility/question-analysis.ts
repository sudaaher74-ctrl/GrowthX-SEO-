import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const STOP = new Set('which what where how when why can should would could does do is are the a an of in on at to for and or with from your my i me best brands brand services service recommend consider compare buying buy offer offers'.split(' '));
const words = (text: string): string[] => {
  const matches: string[] = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(matches.filter(word => word.length > 2 && !STOP.has(word)))];
};
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function context(prisma: PrismaService, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { websites: { where: { scope: 'own' } }, competitors: { include: { website: true } } } });
  if (!project) throw new NotFoundException('Project not found');
  const ids = [...project.websites.map(w => w.id), ...project.competitors.map(c => c.websiteId).filter((id): id is string => !!id)];
  const jobs = ids.length ? await prisma.crawlJob.findMany({ where: { websiteId: { in: ids }, status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, distinct: ['websiteId'], select: { id: true, websiteId: true } }) : [];
  const pages = (await Promise.all(jobs.map(job => prisma.page.findMany({ take: 100, orderBy: { url: 'asc' }, where: { crawlJobId: job.id, statusCode: { gte: 200, lt: 300 } }, select: { id: true, crawlJobId: true, url: true, title: true, metaDescription: true, h1: true, h2: true, wordCount: true, pageType: true, schemas: { where: { isValid: true }, select: { schemaType: true } }, issues: { where: { status: 'OPEN' }, select: { issueType: true, severity: true, description: true }, take: 5 } } })))).flat();
  const ownJobs = new Set(jobs.filter(j => project.websites.some(w => w.id === j.websiteId)).map(j => j.id));
  const auditedPages = ownJobs.size ? await prisma.page.count({ where: { crawlJobId: { in: [...ownJobs] }, statusCode: { gte: 200, lt: 300 } } }) : 0;
  const brand = [...new Set([project.name, ...project.websites.flatMap(w => [w.domain, w.domain.replace(/^www\./, '').split('.')[0]])].map(normalize).filter(Boolean))];
  return { project, jobs, pages, ownPages: pages.filter(p => ownJobs.has(p.crawlJobId)), auditedPages, brand };
}

function isReputation(text: string, brand: string[]) {
  const value = ` ${normalize(text)} `;
  return brand.some(b => value.includes(` ${b} `));
}

function matchingPage(text: string, pages: any[]) {
  const terms = words(text);
  const scored = pages.map(page => {
    const content = new Set(words([page.title, page.metaDescription, ...page.h1, ...page.h2, page.url].join(' ')));
    const matched = terms.filter(t => content.has(t));
    return { page, matched, score: terms.length ? matched.length / terms.length : 0 };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0];
  // A partial keyword match is a candidate page, not proof it answers the question.
  if (!best || best.score < 0.3) return null;
  const schemaTypes: string[] = best.page.schemas.map((s: any) => String(s.schemaType));
  const faqSchema = schemaTypes.some(t => /faq/i.test(t));
  const faqHeading = best.page.h2.some((h: string) => /\?|frequently asked|\bfaq\b/i.test(h));
  return { url: best.page.url, title: best.page.title, matchScore: best.score, signals: { directAnswer: false, directAnswerText: null, faq: faqSchema || faqHeading, faqSource: faqSchema ? 'SCHEMA' : faqHeading ? 'HEADINGS' : null, schemaTypes, termCoverage: best.score, missingTerms: terms.filter(t => !best.matched.includes(t)), wordCount: best.page.wordCount, htmlAvailable: false }, issues: best.page.issues };
}

export async function questionAnalysis(prisma: PrismaService, projectId: string) {
  const ctx = await context(prisma, projectId);
  const prompts = await prisma.aiVisibilityPrompt.findMany({ where: { projectId, isActive: true }, orderBy: { createdAt: 'asc' }, include: { responses: { orderBy: { createdAt: 'desc' }, take: 1, include: { analysis: true, mentions: true } } } });
  const questions = prompts.map(prompt => {
    const response = prompt.responses[0];
    const group = isReputation(prompt.text, ctx.brand) ? 'REPUTATION' : 'BUYER';
    const measured = response && !response.errorMessage && response.analysis;
    const ownPage = matchingPage(prompt.text, ctx.ownPages);
    const rivals = ctx.project.competitors.map(rival => {
      const job = ctx.jobs.find(j => j.websiteId === rival.websiteId);
      return { domain: rival.domain, label: rival.label || rival.name || rival.domain, crawled: !!job, page: matchingPage(prompt.text, ctx.pages.filter(p => p.crawlJobId === job?.id)) };
    });
    return {
      id: prompt.id, text: prompt.text, cluster: prompt.category || null, group,
      outcome: !response ? 'NOT_MEASURED' : !measured ? 'FAILED' : response.analysis?.brandMentioned ? 'CITED' : 'NOT_CITED',
      answer: measured ? { assistant: response.provider, model: response.model, checkedAt: response.createdAt.toISOString(), cited: response.analysis!.brandMentioned, position: response.analysis!.brandPosition, competitorsCited: response.mentions.filter(m => !m.isCustomer).map(m => m.brandName), answerExcerpt: response.rawResponse?.slice(0, 2400) || null } : null,
      failure: response && !measured ? response.errorMessage || 'Response analysis is not available yet.' : null,
      verdict: group === 'REPUTATION' || ctx.ownPages.length === 0 ? 'NOT_APPLICABLE' : !ownPage ? 'CONTENT_GAP' : ownPage.issues.length ? 'PAGE_HAS_ISSUES' : 'PAGE_FOUND',
      ownPage, rivals, comparison: [],
    };
  });
  return { projectId, auditAvailable: ctx.auditedPages > 0, auditedPages: ctx.auditedPages, competitorsTracked: ctx.project.competitors.length, competitorsCrawled: ctx.project.competitors.filter(c => ctx.jobs.some(j => j.websiteId === c.websiteId)).length, questions };
}

export async function questionSuggestions(prisma: PrismaService, projectId: string) {
  const ctx = await context(prisma, projectId);
  const [tracked, gaps] = await Promise.all([
    prisma.aiVisibilityPrompt.findMany({ where: { projectId, isActive: true }, select: { text: true } }),
    prisma.contentGap.findMany({ where: { projectId, status: 'OPEN' }, orderBy: { opportunityScore: 'desc' }, take: 20, select: { title: true, relatedKeywords: true } }),
  ]);
  const seen = new Set(tracked.map(p => normalize(p.text)));
  const suggestions: {text: string; source: 'OWN_PAGE' | 'RIVAL_PAGE' | 'CONTENT_GAP'; evidenceUrl: string | null; evidence: string; competitorDomain: string | null}[] = [];
  const add = (topic: string, source: 'OWN_PAGE' | 'RIVAL_PAGE' | 'CONTENT_GAP', evidenceUrl: string | null, competitorDomain: string | null) => {
    let clean = topic.split(/[|–—]/)[0].trim();
    for (const b of ctx.brand) clean = clean.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
    clean = clean.replace(/^[\s:,-]+|[\s:,-]+$/g, '');
    if (words(clean).length < 2 || clean.length > 140 || /\b(sign in|login|cart|privacy|terms|contact us|about us|home)\b/i.test(clean)) return;
    const text = `What should I look for when choosing ${clean.replace(/\?$/, '')}?`;
    if (seen.has(normalize(text)) || isReputation(text, ctx.brand)) return;
    seen.add(normalize(text));
    suggestions.push({ text, source, evidenceUrl, evidence: source === 'CONTENT_GAP' ? `Based on the open content gap: ${topic}` : `Based on the crawled page topic: ${topic}`, competitorDomain });
  };
  for (const page of ctx.ownPages) if (page.h1[0] || page.title) add(page.h1[0] || page.title!, 'OWN_PAGE', page.url, null);
  for (const gap of gaps) add(gap.relatedKeywords[0] || gap.title, 'CONTENT_GAP', null, null);
  const ownIds = new Set(ctx.ownPages.map(p => p.id));
  const rivalPages = ctx.pages.filter(p => !ownIds.has(p.id));
  for (const page of rivalPages) {
    const job = ctx.jobs.find(j => j.id === page.crawlJobId);
    const rival = ctx.project.competitors.find(c => c.websiteId === job?.websiteId);
    if (page.h1[0] || page.title) add(page.h1[0] || page.title!, 'RIVAL_PAGE', page.url, rival?.domain || null);
  }
  return { suggestions: suggestions.slice(0, 20), basedOn: { ownPages: ctx.ownPages.length, rivalPages: rivalPages.length, contentGaps: gaps.length } };
}
