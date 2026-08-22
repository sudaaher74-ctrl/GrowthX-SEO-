import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AskQuestionDto, CreateThreadDto } from './market-research.controller';
import { ContentRequestDto } from '../automation/content-agent.controller';

/**
 * The DTOs against the real global pipe.
 *
 * `main.ts` configures `ValidationPipe({ whitelist: true, transform: true })`,
 * and whitelist mode deletes every property of a DTO that carries no
 * class-validator decorator. An undecorated DTO therefore reaches the handler
 * as `{}` no matter what the browser sent, and the handler crashes on the first
 * field it touches — which is exactly how "Internal server error" appeared on
 * every Market Research question. Decorators are what keep a field, so this
 * asserts the fields actually arrive rather than asserting the decorators exist.
 */
describe('Market Research DTOs under the global ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false });

  const through = <T>(value: unknown, metatype: any): Promise<T> =>
    pipe.transform(value, { type: 'body', metatype }) as Promise<T>;

  it('keeps the question the browser sent', async () => {
    const result = await through<AskQuestionDto>(
      { question: 'What changed in this market this week?' },
      AskQuestionDto,
    );

    expect(result.question).toBe('What changed in this market this week?');
  });

  it('keeps threadId and deepResearch on a follow-up', async () => {
    const result = await through<AskQuestionDto>(
      { question: 'And our competitors?', threadId: 'thread_1', deepResearch: true },
      AskQuestionDto,
    );

    expect(result).toEqual({ question: 'And our competitors?', threadId: 'thread_1', deepResearch: true });
  });

  it('rejects a body with no question as a 400, not a 500', async () => {
    await expect(through({}, AskQuestionDto)).rejects.toThrow(BadRequestException);
  });

  it('drops properties the DTO does not declare', async () => {
    const result = await through<AskQuestionDto>(
      { question: 'q', organizationId: 'org_from_the_browser' },
      AskQuestionDto,
    );

    expect(result).toEqual({ question: 'q' });
  });

  // The route defaults an absent title, so requiring one here would 400 a call
  // that is meant to work.
  it('allows a thread with no title', async () => {
    await expect(through<CreateThreadDto>({}, CreateThreadDto)).resolves.toEqual({});
  });

  it('keeps every field of a content request', async () => {
    const result = await through<ContentRequestDto>(
      { kind: 'GBP_POST', topic: 'winter menu', location: 'Pune' },
      ContentRequestDto,
    );

    expect(result).toEqual({ kind: 'GBP_POST', topic: 'winter menu', location: 'Pune' });
  });
});
