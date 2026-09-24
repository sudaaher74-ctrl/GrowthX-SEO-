import { words } from './question-terms';

export type QuestionGroup = 'BUYER' | 'REPUTATION';

/**
 * The spellings of the customer's brand a question might contain: the
 * project name ("Aiva"), each domain ("aivaenterprises.com") and each domain's
 * label ("aivaenterprises").
 */
export function brandTerms(projectName: string | null | undefined, domains: string[]): string[] {
  const terms = new Set<string>();
  const add = (value?: string | null) => {
    const clean = (value ?? '').trim().toLowerCase();
    if (clean.length >= 3) terms.add(clean);
  };
  add(projectName);
  for (const domain of domains) {
    add(domain);
    add(domain.split('.')[0]);
  }
  return [...terms];
}

/**
 * A question that names the brand is about the brand's reputation, not about
 * whether a buyer who has never heard of it gets pointed to it.
 *
 * "is Aiva legitimate" is answered by repeating "Aiva", so it reads as a
 * citation every time and says nothing about visibility. Counting those in
 * citation share is what produced a "cited in 4 of 4" that meant nothing.
 * Classified from the text, so a question the customer types in lands in the
 * right group too.
 */
export function questionGroup(question: string, brand: string[]): QuestionGroup {
  const lower = question.toLowerCase();
  const questionWords = new Set(words(question));
  for (const term of brand) {
    if (term.includes('.')) {
      if (lower.includes(term)) return 'REPUTATION';
      continue;
    }
    const termWords = words(term);
    if (termWords.length === 1 ? questionWords.has(termWords[0]) : lower.includes(termWords.join(' '))) {
      return 'REPUTATION';
    }
  }
  return 'BUYER';
}
