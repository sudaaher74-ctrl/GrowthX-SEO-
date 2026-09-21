import { GbpAnalyzerService } from './gbp-analyzer.service';
import { AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

describe('GbpAnalyzerService', () => {
  const projectId = 'proj-123';
  const organizationId = 'org-456';

  const mockLocationData = {
    name: 'locations/1001',
    title: 'Acme Dental Clinic',
    websiteUri: 'https://acmedental.example.com',
    profile: {
      description: 'General dentistry practice located in downtown.',
    },
    categories: {
      primaryCategory: { displayName: 'Dentist' },
    },
  };

  const mockProject = {
    name: 'Acme Dental Clinic',
    locations: [{ placeId: 'ChIJ123456789' }],
  };

  function buildService(overrides: {
    locationData?: any;
    project?: any;
    aiResponseText?: string;
    fetchLocationError?: Error;
    generateError?: Error;
  } = {}) {
    const fetchLocation = overrides.fetchLocationError
      ? jest.fn().mockRejectedValue(overrides.fetchLocationError)
      : jest.fn().mockResolvedValue(overrides.locationData !== undefined ? overrides.locationData : mockLocationData);

    const gbp = {
      fetchLocation,
      patchLocation: jest.fn(),
      replyToReview: jest.fn(),
      sync: jest.fn(),
    };

    const projectFindUnique = jest.fn().mockResolvedValue(
      overrides.project !== undefined ? overrides.project : mockProject,
    );

    const gbpFixProposalCreate = jest.fn().mockImplementation(async ({ data }) => ({
      id: `prop-${Math.random().toString(36).substring(2, 9)}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const prisma = {
      project: { findUnique: projectFindUnique },
      gbpFixProposal: { create: gbpFixProposalCreate },
    };

    const routerGenerate = overrides.generateError
      ? jest.fn().mockRejectedValue(overrides.generateError)
      : jest.fn().mockResolvedValue({
          text:
            overrides.aiResponseText !== undefined
              ? overrides.aiResponseText
              : JSON.stringify({
                  proposals: [
                    {
                      field: 'profile.description',
                      currentValue: 'General dentistry practice located in downtown.',
                      proposedValue:
                        'Leading downtown cosmetic and general dentistry practice offering dental implants, teeth whitening, and emergency care.',
                      rationale:
                        'Expands local keyword targeting to include high-intent services like implants and emergency care.',
                    },
                    {
                      field: 'categories',
                      currentValue: 'Dentist',
                      proposedValue: 'Dentist, Cosmetic Dentist, Dental Clinic',
                      rationale: 'Adding secondary categories captures searches for cosmetic procedures.',
                    },
                  ],
                }),
        });

    const router = {
      generate: routerGenerate,
    };

    const service = new GbpAnalyzerService(prisma as any, gbp as any, router as any);

    return {
      service,
      gbp,
      prisma,
      router,
      fetchLocation,
      projectFindUnique,
      gbpFixProposalCreate,
      routerGenerate,
    };
  }

  describe('analyzeProfile', () => {
    it('fetches live location data, queries project context, invokes AI with schema, and creates PENDING proposals', async () => {
      const { service, fetchLocation, projectFindUnique, routerGenerate, gbpFixProposalCreate } = buildService();

      const proposals = await service.analyzeProfile(projectId, organizationId);

      // 1. Live location fetched
      expect(fetchLocation).toHaveBeenCalledWith(projectId);

      // 2. Project context queried
      expect(projectFindUnique).toHaveBeenCalledWith({
        where: { id: projectId },
        select: { name: true, locations: true },
      });

      // 3. AI router called with task, organizationId, jsonSchema, and prompt containing project & location info
      expect(routerGenerate).toHaveBeenCalledTimes(1);
      const aiCallArgs = routerGenerate.mock.calls[0][0];
      expect(aiCallArgs.task).toBe(AiTask.LOCAL_SEO_ANALYSIS);
      expect(aiCallArgs.organizationId).toBe(organizationId);
      expect(aiCallArgs.prompt).toContain('Acme Dental Clinic');
      expect(aiCallArgs.prompt).toContain('locations/1001');
      expect(aiCallArgs.jsonSchema).toBeDefined();
      expect(aiCallArgs.maxTokens).toBe(4000);

      // 4. Proposals saved to prisma.gbpFixProposal with status PENDING
      expect(gbpFixProposalCreate).toHaveBeenCalledTimes(2);
      expect(gbpFixProposalCreate).toHaveBeenNthCalledWith(1, {
        data: {
          projectId,
          field: 'profile.description',
          currentValue: 'General dentistry practice located in downtown.',
          proposedValue:
            'Leading downtown cosmetic and general dentistry practice offering dental implants, teeth whitening, and emergency care.',
          rationale:
            'Expands local keyword targeting to include high-intent services like implants and emergency care.',
          status: 'PENDING',
        },
      });
      expect(gbpFixProposalCreate).toHaveBeenNthCalledWith(2, {
        data: {
          projectId,
          field: 'categories',
          currentValue: 'Dentist',
          proposedValue: 'Dentist, Cosmetic Dentist, Dental Clinic',
          rationale: 'Adding secondary categories captures searches for cosmetic procedures.',
          status: 'PENDING',
        },
      });

      // 5. Returns parsed proposals
      expect(proposals).toHaveLength(2);
      expect(proposals[0].field).toBe('profile.description');
      expect(proposals[1].field).toBe('categories');
    });

    it('parses AI response wrapped in markdown json code fences (```json ... ```)', async () => {
      const fencedJson = `
Here is the audit and recommendations:
\`\`\`json
{
  "proposals": [
    {
      "field": "serviceArea",
      "currentValue": "",
      "proposedValue": "Downtown, Uptown, Metro Area",
      "rationale": "Specifying service areas clarifies neighborhood coverage."
    }
  ]
}
\`\`\`
Hope this helps!
      `.trim();

      const { service, gbpFixProposalCreate } = buildService({ aiResponseText: fencedJson });

      const proposals = await service.analyzeProfile(projectId, organizationId);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].field).toBe('serviceArea');
      expect(gbpFixProposalCreate).toHaveBeenCalledTimes(1);
      expect(gbpFixProposalCreate).toHaveBeenCalledWith({
        data: {
          projectId,
          field: 'serviceArea',
          currentValue: '',
          proposedValue: 'Downtown, Uptown, Metro Area',
          rationale: 'Specifying service areas clarifies neighborhood coverage.',
          status: 'PENDING',
        },
      });
    });

    it('parses AI response wrapped in untagged markdown code fences (``` ... ```)', async () => {
      const fencedJson = `
\`\`\`
{
  "proposals": [
    {
      "field": "regularHours",
      "proposedValue": "Open Mon-Sat 8am-6pm",
      "rationale": "Extend weekend visibility."
    }
  ]
}
\`\`\`
      `.trim();

      const { service, gbpFixProposalCreate } = buildService({ aiResponseText: fencedJson });

      const proposals = await service.analyzeProfile(projectId, organizationId);

      expect(proposals).toHaveLength(1);
      expect(gbpFixProposalCreate).toHaveBeenCalledWith({
        data: {
          projectId,
          field: 'regularHours',
          currentValue: '', // default fallback when currentValue is omitted
          proposedValue: 'Open Mon-Sat 8am-6pm',
          rationale: 'Extend weekend visibility.',
          status: 'PENDING',
        },
      });
    });

    it('extracts candidate JSON when AI response does not use markdown fences', async () => {
      const textWithRawJson = `Based on your profile: {"proposals": [{"field": "primaryPhone", "proposedValue": "+1-555-0199", "rationale": "Use direct line."}]} That is all.`;

      const { service, gbpFixProposalCreate } = buildService({ aiResponseText: textWithRawJson });

      const proposals = await service.analyzeProfile(projectId, organizationId);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].field).toBe('primaryPhone');
      expect(gbpFixProposalCreate).toHaveBeenCalledTimes(1);
    });

    it('handles an empty proposals array gracefully without throwing', async () => {
      const emptyJson = JSON.stringify({ proposals: [] });
      const { service, gbpFixProposalCreate } = buildService({ aiResponseText: emptyJson });

      const proposals = await service.analyzeProfile(projectId, organizationId);

      expect(proposals).toEqual([]);
      expect(gbpFixProposalCreate).not.toHaveBeenCalled();
    });

    it('handles missing project record by defaulting project name cleanly in prompt', async () => {
      const { service, projectFindUnique, routerGenerate, gbpFixProposalCreate } = buildService({ project: null });

      const proposals = await service.analyzeProfile(projectId, organizationId);

      expect(projectFindUnique).toHaveBeenCalledWith({
        where: { id: projectId },
        select: { name: true, locations: true },
      });
      const prompt = routerGenerate.mock.calls[0][0].prompt;
      expect(prompt).toContain('undefined'); // project?.name is undefined
      expect(proposals).toHaveLength(2);
      expect(gbpFixProposalCreate).toHaveBeenCalledTimes(2);
    });

    it('throws when AI returns an empty or whitespace-only response', async () => {
      const { service, gbpFixProposalCreate } = buildService({ aiResponseText: '   \n   ' });

      await expect(service.analyzeProfile(projectId, organizationId)).rejects.toThrow(
        'AI failed to generate a response',
      );
      expect(gbpFixProposalCreate).not.toHaveBeenCalled();
    });

    it('throws when AI returns malformed text that cannot be parsed as JSON', async () => {
      const { service, gbpFixProposalCreate } = buildService({
        aiResponseText: 'I am sorry, but as an AI I cannot evaluate this profile right now.',
      });

      await expect(service.analyzeProfile(projectId, organizationId)).rejects.toThrow(
        'Failed to parse AI response as JSON',
      );
      expect(gbpFixProposalCreate).not.toHaveBeenCalled();
    });

    it('propagates error and aborts if gbp.fetchLocation fails', async () => {
      const fetchError = new Error('Google Business Profile API connection timed out');
      const { service, routerGenerate, gbpFixProposalCreate } = buildService({
        fetchLocationError: fetchError,
      });

      await expect(service.analyzeProfile(projectId, organizationId)).rejects.toThrow(
        'Google Business Profile API connection timed out',
      );
      expect(routerGenerate).not.toHaveBeenCalled();
      expect(gbpFixProposalCreate).not.toHaveBeenCalled();
    });

    it('propagates error and aborts if AI router throws', async () => {
      const routerError = new Error('Rate limit exceeded on LLM quota');
      const { service, gbpFixProposalCreate } = buildService({
        generateError: routerError,
      });

      await expect(service.analyzeProfile(projectId, organizationId)).rejects.toThrow(
        'Rate limit exceeded on LLM quota',
      );
      expect(gbpFixProposalCreate).not.toHaveBeenCalled();
    });
  });
});
