import { collectReportPlans } from './report-plan-findings';

describe('saved report plans', () => {
  const snapshot = (analysis: any) => ({ id: 'snapshot', report: { analysis } });
  function database() {
    return {
      project: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org' }) },
      auditReportSnapshot: { findFirst: jest.fn().mockResolvedValue(snapshot({ fixes: [{ title: 'Repair canonical', whatIsWrong: 'Two conflicting URLs', priority: 'high', steps: ['Choose canonical', 'Update the tag'], pages: 2 }], quickWins: ['Write a missing title'] })) },
      googleReportSnapshot: { findFirst: jest.fn().mockResolvedValue(snapshot({ priorities: [{ title: 'Improve search snippet', steps: ['Rewrite the description'], evidence: 'Saved CTR evidence', measureBy: 'CTR' }] })) },
      competitorReportSnapshot: { findFirst: jest.fn().mockResolvedValue(snapshot({ gaps: [{ title: 'Cover installation', howToBeatIt: ['Publish installation guide'], evidence: 'Observed rival guide' }], plan: [{ week: 'Week 2', actions: ['Publish comparison'] }] })) },
      aiVisibilityJourney: { findFirst: jest.fn().mockResolvedValue({ id: 'journey', analysis: [{ provider: 'GEMINI', model: 'configured-model', actions: [{ title: 'Answer buyer questions', steps: ['Create answer page'], evidenceIds: ['answer-1'], measureBy: 'Next scan mentions' }] }, { provider: 'OPENROUTER', actions: [{ title: 'Answer buyer questions', steps: ['Create answer page'], evidenceIds: ['answer-2'] }] }] }) },
      savedPlan: { findMany: jest.fn().mockResolvedValue([]) },
    };
  }
  it('imports all four modules, weekly actions, quick wins and evidence without duplicating identical AI actions', async () => {
    const db = database(); const result = await collectReportPlans(db as any, 'project');
    expect(result).toHaveLength(6);
    expect(new Set(result.map(r => r.source))).toEqual(new Set(['WEBSITE', 'SEARCH_CONSOLE', 'COMPETITOR', 'MARKET']));
    const ai = result.find(r => r.source === 'MARKET')!;
    expect(ai.evidence.map(e => e.value).join(' ')).toContain('answer-1');
    expect(ai.evidence.map(e => e.value).join(' ')).toContain('answer-2');
    expect(result.find(r => r.title === 'Repair canonical')?.recommendedAction).toContain('2. Update the tag');
    for (const model of [db.auditReportSnapshot, db.googleReportSnapshot, db.competitorReportSnapshot, db.aiVisibilityJourney]) expect(model.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: 'project' }) }));
  });
  it('does not invent Google actions when no report or connected evidence exists', async () => {
    const db = database(); db.googleReportSnapshot.findFirst.mockResolvedValue(null);
    const result = await collectReportPlans(db as any, 'project');
    expect(result.some(r => r.source === 'SEARCH_CONSOLE')).toBe(false);
  });
  it('fails visibly on source read failures instead of returning an empty successful collection', async () => {
    const db = database(); db.competitorReportSnapshot.findFirst.mockRejectedValue(new Error('database unavailable'));
    await expect(collectReportPlans(db as any, 'project')).rejects.toThrow('database unavailable');
  });
});
