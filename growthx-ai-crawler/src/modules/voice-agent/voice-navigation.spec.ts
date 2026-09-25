import { matchNavigation } from './voice-agent.service';

describe('matchNavigation', () => {
  it.each([
    ['can you open website audit', '/website'],
    ['Open Website Audit', '/website'],
    ['go to reports', '/reports'],
    ['take me to the competitor intelligence page', '/competitor-intelligence'],
    ['open google business profile', '/google-business-profile'],
    ['please navigate to AI visibility', '/ai-visibility'],
    ['open the issues tab', '/website?tab=issues'],
    ['switch to settings', '/settings'],
    ['open GEO & AI overviews', '/website?tab=geo'],
  ])('%s → %s', (text, route) => {
    expect(matchNavigation(text)?.route).toBe(route);
  });

  it('prefers the longest page name', () => {
    expect(matchNavigation('open website audit')?.destination).toBe('website audit');
  });

  it.each([
    'run a full SEO audit',
    'crawl our website',
    'start an audit',
    'add competitor example.com',
    'what are my top recommendations',
    'open',
  ])('leaves "%s" to the classifier', (text) => {
    expect(matchNavigation(text)).toBeNull();
  });
});
