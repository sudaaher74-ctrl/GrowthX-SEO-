/**
 * Robust JSON extractor and parser that sanitizes AI model output.
 */
import { ServiceUnavailableException } from '@nestjs/common';

/** Control characters that are illegal inside a JSON string literal. */
const ILLEGAL_CONTROL_CHARS = /[\x00-\x1F\x7F-\x9F]/g;

/** Closes a JSON document the model stopped writing partway through. */
function repairTruncatedJson(candidate: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  // Where the last complete value ended, so a half-written key can be dropped.
  let lastSafeIndex = -1;
  // True when the open string is a value rather than a key, which decides
  // whether a half-written string is worth keeping or has to be discarded.
  let openStringIsValue = false;
  let lastMeaningful = '';

  for (let i = 0; i < candidate.length; i++) {
    const char = candidate[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') {
        inString = false;
        lastSafeIndex = i;
        lastMeaningful = '"';
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      // A string opened straight after `:` or `[` is a value; after `{` or `,`
      // in an object it is the next key.
      openStringIsValue = lastMeaningful === ':' || lastMeaningful === '[';
    } else if (char === '{' || char === '[') {
      stack.push(char === '{' ? '}' : ']');
      lastMeaningful = char;
    } else if (char === '}' || char === ']') {
      stack.pop();
      lastSafeIndex = i;
      lastMeaningful = char;
    } else if (char === ',') {
      lastSafeIndex = i - 1;
      lastMeaningful = char;
    } else if (!/\s/.test(char)) {
      lastMeaningful = char;
    }
  }

  if (stack.length === 0 && !inString) return null;

  // A string cut off mid-value keeps what was written: a partial sentence is
  // worth more to the caller than a dropped field.
  if (inString && openStringIsValue) {
    const withoutDanglingEscape = escaped ? candidate.slice(0, -1) : candidate;
    return withoutDanglingEscape + '"' + stack.reverse().join('');
  }

  if (lastSafeIndex < 0) return null;

  // Otherwise cut back to the last value that finished, drop any dangling
  // comma or half-written key, then close every container left open.
  let repaired = candidate.slice(0, lastSafeIndex + 1).replace(/[,\s]*$/, '');
  repaired = repaired.replace(/,\s*"[^"]*"\s*:?\s*$/, '');

  return repaired + stack.reverse().join('');
}

export function extractAndParseJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from AI model');
  }

  // Reasoning models leak a thinking block into the answer when they are cut
  // off mid-stream; it is prose, and it never parses.
  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();

  // 1. Check for standard markdown code fences (```json ... ``` or ``` ...)
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // An unterminated fence means the answer was cut off inside the block.
    const openFence = cleaned.match(/```(?:json)?\s*([\s\S]*)$/i);
    if (openFence && openFence[1]) cleaned = openFence[1].trim();
  }

  // 2. Locate outermost JSON object or array. A missing closing brace means the
  // answer was truncated, so keep everything from the opening one and let the
  // repair pass below finish the document.
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = cleaned.lastIndexOf('}');
    cleaned =
      lastBrace > firstBrace
        ? cleaned.substring(firstBrace, lastBrace + 1)
        : cleaned.substring(firstBrace);
  } else if (firstBracket !== -1) {
    const lastBracket = cleaned.lastIndexOf(']');
    cleaned =
      lastBracket > firstBracket
        ? cleaned.substring(firstBracket, lastBracket + 1)
        : cleaned.substring(firstBracket);
  }

  // 3. Attempt direct JSON.parse
  try {
    return JSON.parse(cleaned) as T;
  } catch (initialError: any) {
    // 4. Attempt secondary cleanup (trailing commas before } or ])
    const sanitized = cleaned
      .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
      .replace(ILLEGAL_CONTROL_CHARS, ''); // strip illegal control chars

    try {
      return JSON.parse(sanitized) as T;
    } catch {
      // 5. Close a document the model ran out of output budget to finish.
      const repaired = repairTruncatedJson(sanitized);
      if (repaired) {
        try {
          return JSON.parse(repaired) as T;
        } catch {
          /* fall through to the error below */
        }
      }

      throw new Error(`Failed to parse structured JSON from AI output: ${initialError.message}`);
    }
  }
}

/**
 * Parses a model's JSON answer, or explains why it could not.
 *
 * Call sites used to swallow a parse failure and return `{}`, which reached the
 * user as an empty record with no error attached — indistinguishable from a
 * model that had nothing to say. Failing loudly is what makes a truncated or
 * empty answer diagnosable.
 *
 * The failure is an upstream-provider problem rather than a bug in this
 * service, so it surfaces as 503 with the cause named.
 */
export function parseModelJson<T = Record<string, any>>(text: string, context?: string): T {
  const where = context ? ` (${context})` : '';

  if (!text || !text.trim()) {
    throw new ServiceUnavailableException(`The AI model returned an empty response${where}.`);
  }

  try {
    return extractAndParseJson<T>(text);
  } catch (error: any) {
    throw new ServiceUnavailableException(
      `The AI model returned a response that could not be read as JSON${where}. ` +
        `${error.message}. First 200 characters: ${text.slice(0, 200)}`,
    );
  }
}
