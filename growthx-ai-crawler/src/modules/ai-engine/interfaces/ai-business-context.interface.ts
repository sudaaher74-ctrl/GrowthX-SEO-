/**
 * Standard business context required for every AI intelligence request.
 */
export interface AiBusinessContext {
  /** The name of the business or brand. */
  businessName: string;

  /** The industry or vertical the business operates in (e.g., "B2B SaaS", "E-commerce fashion", "Dental clinic"). */
  industry: string;

  /** The target geographic market or country (e.g., "India", "United States", "Global"). */
  country?: string;

  /** Target customer persona, demographic, or B2B decision-maker profile. */
  targetAudience?: string;

  /** List or comma-separated string of key competitors. */
  competitors?: string[] | string;

  /** Primary business goals (e.g., "Increase organic inbound leads by 50%", "Boost brand authority"). */
  businessGoals?: string[] | string;

  /** Current website URL or domain name. */
  currentWebsite?: string;

  /** Current social media handles/links (e.g., Instagram, LinkedIn, YouTube, X). */
  currentSocialMedia?: Record<string, string> | string;

  /** Current SEO performance, crawled metrics, top keywords, or crawl findings. */
  currentSeoData?: Record<string, any> | string;

  /** Optional additional domain-specific instructions or notes. */
  additionalNotes?: string;
}

/**
 * Helper to format the standard prompt structure across all intelligence tasks.
 */
export function formatStandardBusinessPrompt(context: AiBusinessContext, taskInstruction: string): string {
  const sanitizeList = (val?: string[] | string): string => {
    if (!val) return 'Not specified';
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : 'Not specified';
    return val.trim() || 'Not specified';
  };

  const sanitizeObject = (val?: Record<string, any> | string): string => {
    if (!val) return 'Not specified';
    if (typeof val === 'string') return val.trim() || 'Not specified';
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  return [
    '=== BUSINESS PROFILE & CONTEXT ===',
    `Business Name: ${context.businessName || 'Not specified'}`,
    `Industry: ${context.industry || 'Not specified'}`,
    `Country: ${context.country || 'Global'}`,
    `Target Audience: ${context.targetAudience || 'Not specified'}`,
    `Competitors: ${sanitizeList(context.competitors)}`,
    `Business Goals: ${sanitizeList(context.businessGoals)}`,
    `Current Website: ${context.currentWebsite || 'Not specified'}`,
    `Current Social Media: ${sanitizeObject(context.currentSocialMedia)}`,
    `Current SEO Data: ${sanitizeObject(context.currentSeoData)}`,
    context.additionalNotes ? `Additional Context: ${context.additionalNotes}` : '',
    '',
    '=== TASK INSTRUCTION ===',
    taskInstruction,
    '',
    '=== OUTPUT REQUIREMENT ===',
    'CRITICAL: Return ONLY valid, RFC 8259 compliant JSON matching the requested structure.',
    'Do NOT include any conversational intro, markdown markdown fences, or trailing remarks outside the JSON.',
  ].filter(Boolean).join('\n');
}
