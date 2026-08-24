/**
 * Robust JSON extractor and parser that sanitizes AI model output.
 */
export function extractAndParseJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from AI model');
  }

  let cleaned = rawText.trim();

  // 1. Check for standard markdown code fences (```json ... ``` or ``` ...)
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  // 2. Locate outermost JSON object or array
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = cleaned.lastIndexOf(']');
    if (lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }
  }

  // 3. Attempt direct JSON.parse
  try {
    return JSON.parse(cleaned) as T;
  } catch (initialError: any) {
    // 4. Attempt secondary cleanup (trailing commas before } or ])
    try {
      const sanitized = cleaned
        .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // strip illegal control chars

      return JSON.parse(sanitized) as T;
    } catch {
      throw new Error(`Failed to parse structured JSON from AI output: ${initialError.message}`);
    }
  }
}
