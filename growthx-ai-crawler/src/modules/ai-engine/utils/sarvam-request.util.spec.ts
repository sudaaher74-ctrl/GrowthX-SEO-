import {
  SARVAM_DEFAULT_MODEL,
  buildSarvamBody,
  clampSarvamMaxTokens,
  describeEmptySarvamResponse,
  readSarvamMessage,
  relaxSarvamBody,
  resolveSarvamMaxOutputTokens,
  resolveSarvamModel,
  resolveSarvamReasoningEffort,
} from './sarvam-request.util';

/** Stands in for ConfigService without pulling in the Nest container. */
function config(values: Record<string, string | undefined>) {
  return { get: <T = string>(key: string) => values[key] as unknown as T | undefined };
}

describe('Sarvam request shaping', () => {
  const noEnv = config({});

  describe('model resolution', () => {
    it('defaults to the flagship chat model', () => {
      expect(resolveSarvamModel(noEnv).model).toBe(SARVAM_DEFAULT_MODEL);
    });

    it('keeps a model id the chat endpoint actually serves', () => {
      const { model, warning } = resolveSarvamModel(config({ SARVAM_MODEL: 'sarvam-105b-conversations' }));
      expect(model).toBe('sarvam-105b-conversations');
      expect(warning).toBeUndefined();
    });

    // An .env carried over from before Sarvam retired its earlier generation
    // would otherwise fail every request in the product.
    it('corrects a retired model id and says so', () => {
      const { model, warning } = resolveSarvamModel(config({ SARVAM_MODEL: 'sarvam-2b' }));
      expect(model).toBe(SARVAM_DEFAULT_MODEL);
      expect(warning).toContain('sarvam-2b');
    });
  });

  describe('reasoning', () => {
    // The whole reason output went missing: reasoning tokens are charged
    // against the same budget as the answer.
    it('is disabled unless an operator asks for it', () => {
      expect(resolveSarvamReasoningEffort(noEnv)).toBeNull();
    });

    it('honours a configured effort level', () => {
      expect(resolveSarvamReasoningEffort(config({ SARVAM_REASONING_EFFORT: 'high' }))).toBe('high');
    });

    it('ignores a value the API does not accept', () => {
      expect(resolveSarvamReasoningEffort(config({ SARVAM_REASONING_EFFORT: 'maximum' }))).toBeNull();
    });

    // Omitting the key re-enables thinking, so it must always be present.
    it('always sends the field, because null is what turns thinking off', () => {
      const body = buildSarvamBody({
        model: SARVAM_DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 4096,
        reasoningEffort: null,
      });
      expect('reasoning_effort' in body).toBe(true);
      expect(body.reasoning_effort).toBeNull();
    });
  });

  describe('output budget', () => {
    it('defaults to the Starter plan ceiling', () => {
      expect(resolveSarvamMaxOutputTokens(noEnv)).toBe(4096);
    });

    // Callers ask for up to 16000; above the account ceiling Sarvam rejects
    // the request outright.
    it('clamps a request above the account ceiling', () => {
      expect(clampSarvamMaxTokens(16000, { config: noEnv })).toBe(4096);
    });

    it('allows a larger ceiling on a bigger plan', () => {
      const pro = config({ SARVAM_MAX_OUTPUT_TOKENS: '16384' });
      expect(clampSarvamMaxTokens(16000, { config: pro })).toBe(16000);
    });

    // A JSON answer cut off mid-object is worth nothing, so structured calls
    // get a floor even when the caller asked for less.
    it('raises a budget too small to finish a JSON answer', () => {
      expect(clampSarvamMaxTokens(512, { config: noEnv, structured: true })).toBe(1500);
    });

    it('leaves a small budget alone for free-text calls', () => {
      expect(clampSarvamMaxTokens(512, { config: noEnv })).toBe(512);
    });

    it('falls back to the ceiling when the caller names no budget', () => {
      expect(clampSarvamMaxTokens(undefined, { config: noEnv })).toBe(4096);
    });
  });

  describe('reading a completion', () => {
    it('returns the answer and the token counts', () => {
      const read = readSarvamMessage({
        choices: [{ message: { content: '  the answer  ' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      });
      expect(read.text).toBe('the answer');
      expect(read.promptTokens).toBe(10);
      expect(read.completionTokens).toBe(20);
      expect(read.hadReasoning).toBe(false);
    });

    it('keeps the chain of thought out of the answer', () => {
      const read = readSarvamMessage({
        choices: [
          {
            message: { content: '<think>weighing options</think>\n{"a":1}', reasoning_content: 'weighing options' },
            finish_reason: 'stop',
          },
        ],
      });
      expect(read.text).toBe('{"a":1}');
      expect(read.hadReasoning).toBe(true);
    });

    it('drops a thinking block left unclosed by truncation', () => {
      const read = readSarvamMessage({
        choices: [{ message: { content: '<think>still thinking when the budget ran' }, finish_reason: 'length' }],
      });
      expect(read.text).toBe('');
      expect(read.finishReason).toBe('length');
    });
  });

  describe('explaining an empty answer', () => {
    // "The model returned nothing" is not actionable; naming the budget is.
    it('names the exhausted budget and the setting that fixes it', () => {
      const message = describeEmptySarvamResponse(
        { text: '', finishReason: 'length', hadReasoning: true, promptTokens: 100, completionTokens: 512 },
        512,
      );
      expect(message).toContain('512');
      expect(message).toContain('SARVAM_MAX_OUTPUT_TOKENS');
    });

    it('reports a content filter as itself', () => {
      const message = describeEmptySarvamResponse(
        { text: '', finishReason: 'content_filter', hadReasoning: false, promptTokens: 1, completionTokens: 0 },
        4096,
      );
      expect(message).toContain('content filter');
    });
  });

  describe('recovering from a rejected parameter', () => {
    it('drops the field the API named', () => {
      const body = buildSarvamBody({
        model: SARVAM_DEFAULT_MODEL,
        messages: [],
        maxTokens: 4096,
        reasoningEffort: null,
        jsonMode: true,
      });

      const relaxed = relaxSarvamBody(body, "Unsupported parameter: 'response_format'");
      expect(relaxed?.dropped).toBe('response_format');
      expect(relaxed?.body).not.toHaveProperty('response_format');
      // Everything else has to survive, or the retry asks a different question.
      expect(relaxed?.body).toHaveProperty('reasoning_effort');
      expect(relaxed?.body.max_tokens).toBe(4096);
    });

    it('gives up rather than guessing at an unrelated error', () => {
      const body = buildSarvamBody({
        model: SARVAM_DEFAULT_MODEL,
        messages: [],
        maxTokens: 4096,
        reasoningEffort: null,
      });
      expect(relaxSarvamBody(body, 'invalid api key')).toBeNull();
    });
  });
});
