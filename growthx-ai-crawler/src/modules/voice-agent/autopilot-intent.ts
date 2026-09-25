/**
 * Recognising the two things a customer says to the autopilot, without a
 * model call: "my website is brandkettle.co.in, find my competitors" to start
 * it, and "yes" (or "yes, but remove X", or a list of websites) to confirm
 * the competitors it found.
 */

const DOMAIN = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})\b/g;

/** Speech-to-text writes "brandkettle dot co dot in"; this puts the dots back. */
export function spokenDomains(text: string): string[] {
  const joined = text
    .toLowerCase()
    .replace(/\s+dot\s+/g, '.')
    .replace(/https?:\/\//g, '')
    .replace(/\bwww\./g, '');
  const found = joined.match(DOMAIN) ?? [];
  return [...new Set(found.filter((d) => !/^\d+(\.\d+)+$/.test(d)))];
}

const OWNERSHIP =
  /\b(my|our)\s+(website|site|domain|business|company|brand|store|shop)\b|\b(website|site|domain)\s+(is|name is)\b|\bi\s+(own|run|have)\b|\bwe\s+are\b|\bthis is my\b/;

const LEAD_IN = new Set('is name my our website site domain the called its it\'s this'.split(' '));

/** The customer's own website, when they are telling the agent what it is. */
export function matchAutopilotStart(text: string): { domain: string } | null {
  const lower = text.toLowerCase();
  if (!OWNERSHIP.test(lower.replace(/\s+dot\s+/g, '.'))) return null;
  // Spoken, a brand name often arrives split: "my website is brand kettle dot
  // co dot in". Up to three words before the first "dot" are the name, less
  // the words that lead up to it.
  const spoken = /((?:[a-z0-9-]+\s+){0,2}[a-z0-9-]+)\s+dot\s+((?:[a-z]{2,}\s+dot\s+)*[a-z]{2,})\b/.exec(lower);
  if (spoken) {
    const words = spoken[1].split(/\s+/);
    while (words.length && LEAD_IN.has(words[0])) words.shift();
    if (words.length) return { domain: `${words.join('')}.${spoken[2].replace(/\s+dot\s+/g, '.')}` };
  }
  const [domain] = spokenDomains(lower);
  return domain ? { domain } : null;
}

export interface Suggestion {
  domain: string;
  name: string;
}

export type ConfirmationReply =
  | { action: 'confirm'; domains: string[] }
  | { action: 'reject' }
  | null;

const YES =
  /\b(yes|yeah|yep|yup|ya|haan|han|ha|ji|sahi|correct|right|confirm(ed)?|go ahead|proceed|continue|sure|okay|ok|perfect|exactly|do it|start|these are|those are|that'?s right|all of them)\b/;
const NO = /^(no|nope|nah|nahi|not really|wrong|none of (them|these))\b/;
const REMOVE = /\b(remove|drop|delete|exclude|except|without|not|skip|leave out|minus)\b/;
const ADD = /\b(add|also|include|plus|and also|as well)\b/;

/**
 * What the customer's answer means for the list of competitors found. Null
 * when the words are not an answer to the question at all, so the agent can
 * treat them as a normal command.
 */
export function interpretConfirmation(text: string, suggestions: Suggestion[]): ConfirmationReply {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9.\s'-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const mentioned = spokenDomains(lower);
  const named = suggestions.filter(
    (s) => mentioned.includes(s.domain) || (s.name.length > 2 && lower.includes(` ${s.name.toLowerCase()} `)),
  );
  const all = suggestions.map((s) => s.domain);

  if (REMOVE.test(lower) && named.length) {
    const removed = new Set(named.map((s) => s.domain));
    const extra = ADD.test(lower) ? mentioned.filter((d) => !all.includes(d)) : [];
    return { action: 'confirm', domains: [...all.filter((d) => !removed.has(d)), ...extra] };
  }
  const newOnes = mentioned.filter((d) => !all.includes(d));
  if (newOnes.length && ADD.test(lower)) return { action: 'confirm', domains: [...all, ...newOnes] };
  if (mentioned.length && !YES.test(lower)) {
    // Only websites: "my competitors are a.in and b.in".
    return { action: 'confirm', domains: mentioned };
  }
  if (NO.test(lower.trim())) return { action: 'reject' };
  if (YES.test(lower)) return { action: 'confirm', domains: [...all, ...newOnes] };
  return null;
}

/** "a, b and c" */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
