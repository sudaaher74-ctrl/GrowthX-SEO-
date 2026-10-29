/** Remove known unsupported legacy benchmark claims without rewriting real report measurements. */
export function measuredFinding<T extends { summary?: string; evidence?: unknown }>(finding: T): T {
  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  const unsupported = (entry: any) => /industry benchmark|cro benchmark data|google local insights|local seo benchmark/i.test(String(entry?.source ?? '')) || /Commercial pages generate highest user value|600\+ words rank significantly higher|Over 30% of commercial buyer research|0 automated review requests configured|among the top 3 ranking factors/i.test(String(entry?.value ?? ''));
  const hasUnsupported = evidence.some(unsupported) || /convert 3x better|increase conversion rates by over 30%|increase lead conversion rate by 2\.4x/i.test(finding.summary ?? '');
  if (!hasUnsupported) return finding;
  return {
    ...finding,
    summary: 'Suggested improvement based on the available project context. No project-specific conversion or traffic lift has been measured for this recommendation.',
    evidence: [...evidence.filter(entry => !unsupported(entry)), { label: 'Measurement status', value: 'Project-specific performance lift is not measured.', source: 'Data availability' }],
  } as T;
}
