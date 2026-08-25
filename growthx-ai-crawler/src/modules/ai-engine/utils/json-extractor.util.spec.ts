import { ServiceUnavailableException } from '@nestjs/common';
import { extractAndParseJson, parseModelJson } from './json-extractor.util';

describe('extractAndParseJson', () => {
  it('parses a clean object', () => {
    expect(extractAndParseJson('{"summary":"hi"}')).toEqual({ summary: 'hi' });
  });

  it('unwraps a markdown code fence', () => {
    expect(extractAndParseJson('```json\n{"summary":"hi"}\n```')).toEqual({ summary: 'hi' });
  });

  it('ignores prose around the object', () => {
    expect(extractAndParseJson('Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it('strips a reasoning model thinking block', () => {
    expect(extractAndParseJson('<think>weighing it up</think>\n{"a":1}')).toEqual({ a: 1 });
  });

  it('tolerates trailing commas', () => {
    expect(extractAndParseJson('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  // Everything below is what a model that ran out of output budget actually
  // returns. Each of these used to be discarded as an empty result.
  describe('truncated answers', () => {
    it('closes an object cut off inside a nested array', () => {
      const truncated = '{"summary":"Hello","claims":[{"claim":"Test","date';
      expect(extractAndParseJson(truncated)).toEqual({
        summary: 'Hello',
        claims: [{ claim: 'Test' }],
      });
    });

    it('keeps a partial value when the cut lands mid-sentence', () => {
      const truncated = '{"summary":"a long answer that got cut off right he';
      expect(extractAndParseJson(truncated)).toEqual({
        summary: 'a long answer that got cut off right he',
      });
    });

    it('drops a key the model never finished writing', () => {
      expect(extractAndParseJson('{"a":1,"b":2,"c"')).toEqual({ a: 1, b: 2 });
    });

    it('handles a cut inside a deeply nested structure', () => {
      expect(extractAndParseJson('{"a":{"b":{"c":[1,2,{"d":"e')).toEqual({
        a: { b: { c: [1, 2, { d: 'e' }] } },
      });
    });

    it('recovers from an unterminated code fence', () => {
      expect(extractAndParseJson('```json\n{"summary":"hi","items":[{"a":1},{"a":2')).toEqual({
        summary: 'hi',
        items: [{ a: 1 }],
      });
    });
  });

  it('refuses output with no JSON in it at all', () => {
    expect(() => extractAndParseJson('I cannot help with that.')).toThrow(/Failed to parse/);
  });
});

describe('parseModelJson', () => {
  it('returns the parsed object on success', () => {
    expect(parseModelJson('{"a":1}', 'Test')).toEqual({ a: 1 });
  });

  // The bug this replaced: a parse failure returned {}, so a blank record was
  // written and reported as a success.
  it('raises rather than returning an empty object', () => {
    expect(() => parseModelJson('not json', 'Content creation')).toThrow(ServiceUnavailableException);
  });

  it('names the calling feature and shows what came back', () => {
    expect(() => parseModelJson('not json at all', 'Content creation')).toThrow(
      /Content creation.*not json at all/s,
    );
  });

  it('treats an empty answer as a failure of its own', () => {
    expect(() => parseModelJson('   ', 'Strategy')).toThrow(/empty response/);
  });
});
