import { normalizeBrief } from './visibility-workflow.logic';
import type { VisibilityContext } from './visibility-workflow.types';

const offerings = Array.from({ length: 24 }, (_, i) => `Fruit product ${i + 1}`);
const context: VisibilityContext = {
  gatheredAt: '2026-10-20T00:00:00Z', businessName: 'Catalog supplier', domain: 'catalog.test',
  sources: [], cities: [], keyEvents: null, limitations: [],
  facts: [{ id: 'catalog', source: 'website', text: `${offerings.join(', ')} supplied from Panvel.` }],
};
const draft = () => ({
  businessName: context.businessName, offerings, locations: ['Panvel'], evidenceIds: ['catalog'],
  questions: offerings.slice(0, 20).map(offering => ({
    text: `Where can I source ${offering} in Panvel?`, offering, location: 'Panvel',
    intent: 'purchase', rationale: 'Source the audited product', evidenceIds: ['catalog'],
  })),
});

it('retains catalog offerings beyond the twelfth for all reviewed questions', () => {
  const result = normalizeBrief(draft(), context, false, 20);
  expect(result.offerings).toEqual(offerings);
  expect(result.questions[19].offering).toBe('Fruit product 20');
});

it('still rejects questions with unsupported evidence', () => {
  const input = draft();
  input.questions[19].evidenceIds = ['not-a-saved-source'];
  expect(() => normalizeBrief(input, context, false, 20)).toThrow('supporting evidence');
});
