import { googleApiClientError } from './google-api-error';

const googleError = (status: number, message: string) => ({
  response: { status, data: { error: { message } } },
  message,
});

describe('googleApiClientError', () => {
  it('explains a disabled API as a Cloud project setting, not a 500', () => {
    const err = googleApiClientError(
      'Google Search Console API',
      googleError(
        403,
        'Google Search Console API has not been used in project 123 before or it is disabled. Enable it by visiting …',
      ),
    );
    expect(err.getStatus()).toBe(424);
    expect(err.message).toContain('not enabled');
    expect(err.message).toContain('Google Search Console API');
  });

  it('asks to reconnect on any other 403', () => {
    const err = googleApiClientError('Google Search Console API', googleError(403, 'Request had insufficient authentication scopes.'));
    expect(err.getStatus()).toBe(403);
    expect(err.message).toContain('Reconnect Google');
  });

  it('never answers 401, which the web client treats as signed out', () => {
    const err = googleApiClientError('Google Analytics Admin API', googleError(401, 'Invalid Credentials'));
    expect(err.getStatus()).toBe(403);
  });

  it("passes Google's own message through for anything else", () => {
    const err = googleApiClientError('Google Search Console API', googleError(500, 'Backend Error'));
    expect(err.getStatus()).toBe(502);
    expect(err.message).toContain('Backend Error');
  });
});
