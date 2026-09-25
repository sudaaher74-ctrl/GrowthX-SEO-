import { VoiceToolsService } from './voice-tools.service';

function setup(modelText: string) {
  const prisma = {
    project: {
      findUnique: jest.fn().mockResolvedValue({
        organizationId: 'org1',
        websites: [{ domain: 'milquufresh.in' }],
      }),
    },
    competitorDomain: {
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
    },
  };
  const orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined) };
  const aiRouter = { generate: jest.fn().mockResolvedValue({ text: modelText }) };
  const tools = new VoiceToolsService(
    prisma as any,
    orgContext as any,
    aiRouter as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { tools, prisma };
}

describe('discoverCompetitors reads real model output', () => {
  it.each([
    ['a fenced code block', '```json\n[{"domain":"countrydelight.in","name":"Country Delight"}]\n```'],
    ['a <think> preamble', '<think>milk delivery in India…</think>\n[{"domain":"countrydelight.in","name":"Country Delight"}]'],
    ['an object wrapper', '{"competitors":[{"domain":"countrydelight.in","name":"Country Delight"}]}'],
    ['prose around the array', 'Here are the competitors:\n[{"domain":"countrydelight.in","name":"Country Delight"}]\nHope this helps.'],
  ])('handles %s', async (_label, text) => {
    const { tools, prisma } = setup(text);
    const result = await tools.discoverCompetitors('p1', 'u1', 'org1');

    expect(result.success).toBe(true);
    expect(prisma.competitorDomain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ domain: 'countrydelight.in' }) }),
    );
  });

  it('still reports unreadable output as a failure rather than throwing', async () => {
    const { tools } = setup('I cannot help with that.');
    const result = await tools.discoverCompetitors('p1', 'u1', 'org1');
    expect(result.success).toBe(false);
  });
});
