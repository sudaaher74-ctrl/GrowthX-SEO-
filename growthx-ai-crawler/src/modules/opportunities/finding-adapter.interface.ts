export interface NormalisedFinding {
  projectId: string;
  organizationId: string;
  fingerprint: string;
  source: 'WEBSITE' | 'LOCAL' | 'COMPETITOR' | 'SEARCH_CONSOLE' | 'ANALYTICS' | 'MARKET' | 'BACKLINKS' | string;
  category: 'SEO' | 'CONTENT' | 'LOCAL' | 'TECHNICAL' | 'MARKETING' | 'BUSINESS' | 'COMPETITOR' | string;
  title: string;
  summary: string;
  recommendedAction: string;
  evidence: Array<{ label: string; value: string; source: string }>;
  potential: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  impact: number;
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  affectedPages: string[];
  affectedCount: number;
  detailType: string;
  detailRef: string;
}

export interface FindingAdapter {
  readonly source: string;
  collect(projectId: string): Promise<NormalisedFinding[]>;
}
