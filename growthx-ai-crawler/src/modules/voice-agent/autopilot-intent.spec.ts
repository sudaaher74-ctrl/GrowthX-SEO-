import { interpretConfirmation, matchAutopilotStart, spokenDomains } from './autopilot-intent';

const suggestions = [
  { domain: 'chaipoint.com', name: 'Chai Point' },
  { domain: 'teabox.com', name: 'Teabox' },
  { domain: 'vahdamteas.com', name: 'Vahdam' },
];

describe('matchAutopilotStart', () => {
  it.each([
    'my website name is brandkettle.co.in identify my competitors',
    'My website is brandkettle dot co dot in, find my competitors',
    'our site is https://www.brandkettle.co.in please do everything',
    'this is my business brandkettle.co.in',
    'my website name is brand kettle dot co dot in',
    'my website is brandkettle dot co dot in',
  ])('starts the autopilot for "%s"', (text) => {
    expect(matchAutopilotStart(text)).toEqual({ domain: 'brandkettle.co.in' });
  });

  it.each(['add competitor chaipoint.com', 'crawl teabox.com', 'open competitor intelligence', 'my website audit'])(
    'leaves "%s" to the normal commands',
    (text) => {
      expect(matchAutopilotStart(text)).toBeNull();
    },
  );
});

describe('spokenDomains', () => {
  it('reads spoken dots and ignores numbers', () => {
    expect(spokenDomains('it is brand kettle dot co dot in and 4.5 stars')).toEqual(['kettle.co.in']);
    expect(spokenDomains('a.in, B.COM and www.c.co.uk')).toEqual(['a.in', 'b.com', 'c.co.uk']);
  });
});

describe('interpretConfirmation', () => {
  it('takes every suggestion on a plain yes, in English or Hindi', () => {
    for (const yes of ['yes', 'Yes these are my competitors', 'haan sahi hai', 'ok go ahead']) {
      expect(interpretConfirmation(yes, suggestions)).toEqual({ action: 'confirm', domains: ['chaipoint.com', 'teabox.com', 'vahdamteas.com'] });
    }
  });

  it('removes the ones named, by name or website', () => {
    expect(interpretConfirmation('yes but remove Teabox', suggestions)).toEqual({ action: 'confirm', domains: ['chaipoint.com', 'vahdamteas.com'] });
    expect(interpretConfirmation('all except vahdamteas.com', suggestions)).toEqual({ action: 'confirm', domains: ['chaipoint.com', 'teabox.com'] });
  });

  it('adds websites the customer names', () => {
    expect(interpretConfirmation('yes and also add typhoo.in', suggestions)).toEqual({
      action: 'confirm',
      domains: ['chaipoint.com', 'teabox.com', 'vahdamteas.com', 'typhoo.in'],
    });
  });

  it('uses only the websites given when the customer lists their own', () => {
    expect(interpretConfirmation('my competitors are typhoo.in and tetley dot com', suggestions)).toEqual({
      action: 'confirm',
      domains: ['typhoo.in', 'tetley.com'],
    });
  });

  it('hears a no, and ignores unrelated commands', () => {
    expect(interpretConfirmation('no', suggestions)).toEqual({ action: 'reject' });
    expect(interpretConfirmation('open website audit', suggestions)).toBeNull();
  });
});
