const text = { type: "string" };
const texts = { type: "array", items: text };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
});
const array = (items: unknown) => ({ type: "array", items });

export const briefSchema = obj({
  businessName: text,
  summary: text,
  offerings: texts,
  locations: texts,
  evidenceIds: texts,
  questions: {
    ...array(
      obj({
        text,
        offering: text,
        location: text,
        intent: text,
        rationale: text,
        evidenceIds: texts,
      }),
    ),
    minItems: process.env.AI_LOW_COST_POLICY === 'false' ? 10 : 20,
    maxItems: process.env.AI_LOW_COST_POLICY === 'false' ? 10 : 20,
  },
});
export const measurementSchema = obj({
  measurements: array(
    obj({
      answerId: text,
      recommended: { type: "boolean" },
      recommendationQuote: text,
      rivals: array(obj({ name: text, quote: text })),
    }),
  ),
});
export const assessmentSchema = obj({
  summary: text,
  localDemand: text,
  gaps: { ...array(
    obj({
      competitor: text,
      observation: text,
      hypothesis: text,
      evidenceIds: { ...texts, minItems: 1, maxItems: 4 },
    }),
  ), maxItems: 5 },
  actions: { ...array(
    obj({
      title: text,
      priority: { type: "string", enum: ["high", "medium", "low"] },
      timeframe: text,
      steps: { ...texts, minItems: 1, maxItems: 4 },
      measureBy: text,
      evidenceIds: { ...texts, minItems: 1, maxItems: 4 },
    }),
  ), maxItems: 6 },
});
