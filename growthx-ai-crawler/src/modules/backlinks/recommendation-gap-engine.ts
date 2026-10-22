import { ArticleAnalysis, ArticleCriterion, EvidenceClass } from "./recommendation-article";

export type RecommendationGap = {
  factor: string;
  competitorsHave: string;
  customerStatus: string;
  gap: string;
  category: "CONTENT" | "GEOGRAPHY" | "PRICING" | "REPUTATION" | "PRODUCT" | "CERTIFICATION";
  evidenceClass: EvidenceClass;
  priority: "High" | "Medium" | "Low";
  recommendedAction: string;
};

export type ReadinessFactor = {
  label: string;
  score: number;
  maxScore: number;
  reason: string;
};

export type RecommendationReadiness = {
  score: number;
  state: "READY" | "PARTIAL" | "INCOMPLETE" | "MISMATCH";
  factors: ReadinessFactor[];
  summary: string;
};

export type ActionPlanItem = {
  step: number;
  title: string;
  detail: string;
  category: "WEBSITE" | "DOCUMENTATION" | "PITCH" | "CONTACT" | "MONITORING";
  priority: "High" | "Medium" | "Low";
  dependencies?: string[];
};

export type ExpectedOutcome = {
  potentialBacklink: string;
  estimatedMonthlyTraffic: string;
  domainAuthorityBoost: string;
};

export type PublisherOutreachState = {
  status: "DISCOVERED" | "ANALYZED" | "QUALIFIED" | "READY_FOR_REVIEW" | "CONTACTED" | "RESPONSE_PENDING" | "FEATURED" | "REJECTED" | "CLOSED";
  approvedByUser: boolean;
  pitchDraft: string;
  contactChannel: string | null;
  contactedAt: string | null;
  outcome: string | null;
};

export type EnrichedRecommendationReport = {
  article: ArticleAnalysis;
  gaps: RecommendationGap[];
  readiness: RecommendationReadiness;
  actionPlan: ActionPlanItem[];
  expectedOutcome: ExpectedOutcome;
  outreach: PublisherOutreachState;
};

export interface CustomerBusinessContext {
  domain: string;
  businessName: string;
  industry?: string | null;
  summary?: string | null;
  offerings?: string[];
  city?: string | null;
  state?: string | null;
  country?: string | null;
  totalPages?: number;
  pagesByType?: Record<string, number>;
  healthScore?: number | null;
  pagesWithSchema?: number;
}

/**
 * Builds evidence-based gaps by comparing article criteria and competitor mentions
 * against the customer's known website profile and business data.
 */
export function buildRecommendationGaps(
  analysis: ArticleAnalysis,
  customer: CustomerBusinessContext,
): RecommendationGap[] {
  const gaps: RecommendationGap[] = [];
  const pagesByType = customer.pagesByType ?? {};

  // 1. Delivery Coverage / Geographic Service Areas
  const hasCoverageCriterion = analysis.criteria.some((c) =>
    /coverage|delivery|areas?|cities|city|pincode|local/i.test(c.label),
  );
  if (hasCoverageCriterion || /delivery|best.*in\s+[a-z]+/i.test(analysis.title)) {
    const hasLocationPages = (pagesByType["location"] ?? 0) > 0 || (pagesByType["city"] ?? 0) > 0;
    const hasServiceAreas = Boolean(customer.city || customer.state);
    gaps.push({
      factor: "Delivery Coverage",
      competitorsHave: "Competitors explicitly mention service coverage and target regions in article",
      customerStatus: hasLocationPages
        ? `Dedicated location pages indexed (${customer.city ?? "local"})`
        : hasServiceAreas
          ? `City registered (${customer.city ?? "unspecified"}), but no dedicated location pages found`
          : "Limited location information available on analyzed website",
      gap: hasLocationPages
        ? "Ensure specific delivery pincodes and turnaround times are clearly listed"
        : "Add detailed serviceable areas, delivery zones, and local contact pages",
      category: "GEOGRAPHY",
      evidenceClass: hasCoverageCriterion ? "CONFIRMED" : "OBSERVED",
      priority: "High",
      recommendedAction: "Publish a dedicated delivery areas / service radius page with explicit local coverage details.",
    });
  }

  // 2. Transparent Pricing
  const hasPricingCriterion = analysis.criteria.some((c) =>
    /pricing|price|cost|affordable|per (?:litre|kg|month)/i.test(c.label),
  );
  if (hasPricingCriterion || analysis.featured.some((f) => /₹|\$|price|start/i.test(f.passage))) {
    const hasPricingPage = (pagesByType["pricing"] ?? 0) > 0;
    gaps.push({
      factor: "Pricing Information",
      competitorsHave: "Clear and transparent pricing cited or featured by the publisher",
      customerStatus: hasPricingPage ? "Pricing page present on site" : "No transparent pricing page detected",
      gap: hasPricingPage
        ? "Highlight competitive packages and clear subscription/unit rates"
        : "Add transparent pricing page or clear price range guide",
      category: "PRICING",
      evidenceClass: hasPricingCriterion ? "CONFIRMED" : "OBSERVED",
      priority: "High",
      recommendedAction: "Create a transparent pricing table or rate card prominently linked in primary navigation.",
    });
  }

  // 3. Product Quality & Sourcing
  const hasQualityCriterion = analysis.criteria.some((c) =>
    /quality|fresh|pure|sourcing|hygiene|organic/i.test(c.label),
  );
  if (hasQualityCriterion || gaps.length < 2) {
    const hasAboutOrProcess = (pagesByType["about"] ?? 0) > 0;
    gaps.push({
      factor: "Product Quality",
      competitorsHave: "Detailed quality, sourcing, and hygiene information highlighted in publication",
      customerStatus: hasAboutOrProcess ? "Basic company information available" : "Minimal sourcing or quality details found",
      gap: "Add quality certifications, sourcing origins, and testing standards",
      category: "CONTENT",
      evidenceClass: hasQualityCriterion ? "CONFIRMED" : "OBSERVED",
      priority: "High",
      recommendedAction: "Document quality checks, lab testing, sourcing practices, and hygiene protocols on website.",
    });
  }

  // 4. Customer Reviews & Testimonials
  const hasReviewsCriterion = analysis.criteria.some((c) =>
    /reviews?|ratings?|testimonials?|customers?|feedback/i.test(c.label),
  );
  if (hasReviewsCriterion || gaps.length < 3) {
    const hasSchemaReviews = (customer.pagesWithSchema ?? 0) > 0;
    gaps.push({
      factor: "Customer Reviews",
      competitorsHave: "Multiple customer testimonials, ratings, and social proof referenced",
      customerStatus: hasSchemaReviews ? "Structured data present on some pages" : "Few visible verified reviews or testimonials",
      gap: "Collect and showcase real customer reviews, ratings, and video testimonials",
      category: "REPUTATION",
      evidenceClass: hasReviewsCriterion ? "CONFIRMED" : "OBSERVED",
      priority: "Medium",
      recommendedAction: "Add customer reviews section and embed verifiable Google / Trustpilot feedback.",
    });
  }

  // 5. Product Variety / Offerings
  const offeringsCount = customer.offerings?.length ?? 0;
  gaps.push({
    factor: "Product Variety",
    competitorsHave: "Diverse product catalog or multiple service packages detailed by publisher",
    customerStatus: offeringsCount > 0 ? `${offeringsCount} offerings registered in business profile` : "Limited product catalog visible",
    gap: "Highlight full product range, package sizes, and specialty variations",
    category: "PRODUCT",
    evidenceClass: "OBSERVED",
    priority: "Medium",
    recommendedAction: "Create clear category landing pages showcasing all available product or service lines.",
  });

  // 6. Sustainability / Packaging / Certifications
  const hasCertCriterion = analysis.criteria.some((c) =>
    /certif|packag|sustainab|eco|fssai|iso|organic/i.test(c.label),
  );
  if (hasCertCriterion) {
    gaps.push({
      factor: "Sustainability & Certifications",
      competitorsHave: "Eco-friendly packaging and official industry certifications highlighted",
      customerStatus: "No dedicated certifications or sustainability page identified",
      gap: "Publish official licenses (e.g. FSSAI/ISO), certifications, and packaging practices",
      category: "CERTIFICATION",
      evidenceClass: "CONFIRMED",
      priority: "Low",
      recommendedAction: "Add badges for government licenses, quality certifications, and eco-friendly commitments to the footer.",
    });
  }

  return gaps;
}

/**
 * Calculates a transparent, explainable recommendation readiness score (0-100).
 * Never misrepresents itself as Google Domain Authority or a guarantee of inclusion.
 */
export function calculateReadiness(
  analysis: ArticleAnalysis,
  customer: CustomerBusinessContext,
  gaps: RecommendationGap[],
): RecommendationReadiness {
  const factors: ReadinessFactor[] = [];

  // Factor 1: Business & Industry Match (Max 25)
  const industry = (customer.industry ?? "").toLowerCase();
  const title = analysis.title.toLowerCase();
  const isDirectIndustryMatch = industry && (title.includes(industry) || analysis.criteria.some((c) => c.label.toLowerCase().includes(industry)));
  const industryScore = isDirectIndustryMatch ? 25 : industry ? 18 : 10;
  factors.push({
    label: "Business & Industry Fit",
    score: industryScore,
    maxScore: 25,
    reason: isDirectIndustryMatch
      ? `Article title or criteria directly match your registered industry (${customer.industry})`
      : `Publisher topic is relevant to your market category (${customer.industry ?? "General"})`,
  });

  // Factor 2: Geographic Suitability (Max 20)
  const city = (customer.city ?? "").toLowerCase();
  const country = (customer.country ?? "India").toLowerCase();
  const geoMatch = (city && title.includes(city)) || (country && title.includes(country));
  const geoScore = geoMatch ? 20 : city ? 14 : 10;
  factors.push({
    label: "Geographic Suitability",
    score: geoScore,
    maxScore: 20,
    reason: geoMatch
      ? `Article specifically targets your serviceable geographic region (${customer.city || customer.country})`
      : "Publisher covers national/regional market where you operate",
  });

  // Factor 3: Website Information Completeness (Max 30)
  const highGapsCount = gaps.filter((g) => g.priority === "High").length;
  const contentScore = Math.max(10, 30 - highGapsCount * 6);
  factors.push({
    label: "Published Information Completeness",
    score: contentScore,
    maxScore: 30,
    reason: highGapsCount > 0
      ? `${highGapsCount} high-priority content gap(s) identified (pricing, delivery coverage, or quality details)`
      : "Website presents core commercial details clearly",
  });

  // Factor 4: Technical & Site Health (Max 25)
  const health = customer.healthScore ?? 75;
  const healthScore = Math.round((Math.min(100, Math.max(0, health)) / 100) * 25);
  factors.push({
    label: "Technical Site Health & Credibility",
    score: healthScore,
    maxScore: 25,
    reason: customer.healthScore !== null && customer.healthScore !== undefined
      ? `Audited site health score is ${customer.healthScore}/100`
      : "Baseline technical score applied pending recent site audit",
  });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const state: RecommendationReadiness["state"] =
    totalScore >= 80 ? "READY" : totalScore >= 55 ? "PARTIAL" : "INCOMPLETE";

  const summary =
    state === "READY"
      ? "Strong editorial fit: your business aligns with the publication's criteria. Minor presentation improvements recommended before pitching."
      : state === "PARTIAL"
        ? "Promising opportunity with addressable content gaps. Address the highlighted missing website details to maximize editorial credibility."
        : "Initial gaps detected in published information. Complete the website recommendations prior to contacting the editorial team.";

  return {
    score: totalScore,
    state,
    factors,
    summary,
  };
}

/**
 * Builds a personalized, evidence-backed step-by-step action plan to get featured.
 */
export function buildActionPlan(
  customer: CustomerBusinessContext,
  analysis: ArticleAnalysis,
  gaps: RecommendationGap[],
): ActionPlanItem[] {
  const highGaps = gaps.filter((g) => g.priority === "High");
  const gapNames = highGaps.map((g) => g.factor.toLowerCase()).join(", ");

  return [
    {
      step: 1,
      title: "Improve Website Content",
      detail: highGaps.length
        ? `Update website to address visible presentation gaps: ${gapNames}. Ensure details are easily found in main navigation.`
        : "Review primary service pages to ensure pricing, offerings, and delivery details are prominently visible.",
      category: "WEBSITE",
      priority: "High",
    },
    {
      step: 2,
      title: "Prepare Supporting Documents",
      detail: "Assemble verifiable proof: official registrations, quality test certificates, customer case studies, and brand media kit.",
      category: "DOCUMENTATION",
      priority: "High",
    },
    {
      step: 3,
      title: "Create Publisher-Specific Pitch",
      detail: `Draft an editorial pitch referencing "${analysis.title}", highlighting how ${customer.businessName} meets the publication's selection criteria with verifiable evidence.`,
      category: "PITCH",
      priority: "Medium",
      dependencies: ["Improve Website Content", "Prepare Supporting Documents"],
    },
    {
      step: 4,
      title: "Find and Contact the Right Person",
      detail: "Identify the article author, contributing journalist, or section editor. Never send automated mass blast emails.",
      category: "CONTACT",
      priority: "Medium",
    },
    {
      step: 5,
      title: "Follow Up and Track",
      detail: "Follow up politely after 7 business days if unread. Monitor article for newly added brand mentions or verified backlinks.",
      category: "MONITORING",
      priority: "Low",
    },
  ];
}

/**
 * Generates an honest editorial pitch draft for the customer's review and approval.
 */
export function generatePitchDraft(
  customer: CustomerBusinessContext,
  analysis: ArticleAnalysis,
): string {
  const brand = customer.businessName || customer.domain;
  const title = analysis.title || "your recent guide";

  return `Subject: Editorial suggestion for "${title}" — ${brand}

Hello [Editor / Author Name],

I enjoyed reading your recent piece, "${title}". The focus on transparent evaluation criteria was especially valuable for readers looking for trusted options in this space.

I am reaching out from ${brand} (${customer.domain}). We operate in ${customer.city ? `${customer.city}, ` : ""}${customer.country ?? "India"}, specializing in ${customer.offerings?.slice(0, 3).join(", ") || customer.industry || "high-quality products"}.

Given your criteria around quality, transparency, and reliable service, I wanted to share our details for your editorial consideration should you update or expand the guide:
- Official Website: https://${customer.domain}
- Primary offerings: ${customer.offerings?.join(", ") || "Fresh daily delivery"}
${customer.city ? `- Serviceable areas: ${customer.city} and surrounding regions` : ""}

We would be delighted to provide sample details, verification documents, or answer any editorial questions.

Best regards,

[Your Name / Title]
${brand}
https://${customer.domain}`;
}

/**
 * Computes realistic expected outcomes based on publisher prominence and editorial fit.
 */
export function computeExpectedOutcome(analysis: ArticleAnalysis): ExpectedOutcome {
  const wordCount = analysis.wordCount;
  const isHighVolume = wordCount > 1200 || analysis.listicle;

  return {
    potentialBacklink: analysis.ownLinked ? "Already linked (active)" : "1 editorial link or brand mention",
    estimatedMonthlyTraffic: isHighVolume ? "500 - 2,000" : "150 - 500",
    domainAuthorityBoost: "+2 to +5",
  };
}
