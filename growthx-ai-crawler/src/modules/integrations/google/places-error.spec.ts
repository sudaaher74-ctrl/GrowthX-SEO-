import { describePlacesFailure } from './places-error';

describe('describePlacesFailure', () => {
  it('names the project and the fix when Google gives a machine-readable reason', () => {
    const text = describePlacesFailure({
      error: {
        details: [{ reason: 'SERVICE_DISABLED', metadata: { consumer: 'projects/growthx-123' } }],
      },
    });

    expect(text).toContain('SERVICE_DISABLED');
    expect(text).toContain('growthx-123');
    expect(text).toContain('Places API (New) is not enabled');
  });

  it('lists what to check when a 403 carries no reason at all', () => {
    const text = describePlacesFailure({
      error: { code: 403, message: 'The caller does not have permission', status: 'PERMISSION_DENIED' },
    });

    expect(text).toContain('Places API (New) is enabled');
    expect(text).toContain('billing is on');
    expect(text).toContain('GOOGLE_PLACES_API_KEY');
  });

  it('adds nothing for an error it has no advice on', () => {
    expect(describePlacesFailure({ error: { code: 500, status: 'INTERNAL' } })).toBe('');
    expect(describePlacesFailure(null)).toBe('');
  });
});
