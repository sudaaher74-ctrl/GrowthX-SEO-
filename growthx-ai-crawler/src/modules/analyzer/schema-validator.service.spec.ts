import { SchemaValidatorService } from './schema-validator.service';

describe('SchemaValidatorService', () => {
  let service: SchemaValidatorService;

  beforeEach(() => {
    service = new SchemaValidatorService();
  });

  it('safely handles invalid JSON-LD without crashing', () => {
    const invalidJson = '{ "brokenJson: true, missing quote }';
    const results = service.validateSchemas([invalidJson]);

    expect(results.length).toBe(1);
    expect(results[0].schemaType).toBe('INVALID_JSON_LD');
    expect(results[0].isValid).toBe(false);
    expect(results[0].findings[0].severity).toBe('HIGH');
  });

  it('supports @graph wrappers and nested Product schemas', () => {
    const graphData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'Aiva Enterprises',
          url: 'https://aivaenterprises.com',
        },
        {
          '@type': 'Product',
          name: 'Industrial Robotic Arm X-500',
          offers: {
            '@type': 'Offer',
            price: '250000',
            priceCurrency: 'INR',
          },
        },
      ],
    };

    const results = service.validateSchemas([graphData]);
    expect(results.length).toBe(2);
    expect(results[0].schemaType).toBe('ORGANIZATION');
    expect(results[0].isValid).toBe(true);
    expect(results[1].schemaType).toBe('PRODUCT');
    expect(results[1].isValid).toBe(true);
  });

  it('treats missing offers on B2B quote-based product as ADVISORY rather than critical failure', () => {
    const b2bProduct = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Custom Enterprise Transformer 500kVA',
      // No offers or price, because it is custom quoted
    };

    const results = service.validateSchemas([b2bProduct], { isB2B: true });
    expect(results.length).toBe(1);
    expect(results[0].schemaType).toBe('PRODUCT');

    const offersFinding = results[0].findings.find((f) => f.property === 'offers');
    expect(offersFinding).toBeDefined();
    expect(offersFinding?.severity).toBe('MEDIUM');
    expect(offersFinding?.confidence).toBe('ADVISORY');
  });

  it('flags missing required "name" on Product as HIGH severity', () => {
    const unnamedProduct = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      offers: { price: 100 },
    };

    const results = service.validateSchemas([unnamedProduct]);
    expect(results[0].isValid).toBe(false);
    const nameFinding = results[0].findings.find((f) => f.property === 'name');
    expect(nameFinding?.severity).toBe('HIGH');
  });
});
