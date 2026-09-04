import { Injectable, Logger } from '@nestjs/common';

export interface SchemaFinding {
  property: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: 'CONFIRMED' | 'LIKELY' | 'ADVISORY';
  isRequired: boolean;
  recommendation: string;
}

export interface ValidatedSchema {
  schemaType: string;
  isValid: boolean;
  errors: string[];
  findings: SchemaFinding[];
  rawJson: string;
}

@Injectable()
export class SchemaValidatorService {
  private readonly logger = new Logger(SchemaValidatorService.name);

  private readonly supportedTypes: Record<string, string> = {
    'Organization': 'ORGANIZATION',
    'LocalBusiness': 'LOCAL_BUSINESS',
    'Product': 'PRODUCT',
    'Article': 'ARTICLE',
    'NewsArticle': 'ARTICLE',
    'BlogPosting': 'ARTICLE',
    'BreadcrumbList': 'BREADCRUMB',
    'FAQPage': 'FAQ',
    'Review': 'REVIEW',
    'AggregateRating': 'REVIEW',
    'VideoObject': 'VIDEO',
    'Recipe': 'RECIPE',
    'Event': 'EVENT',
  };

  /**
   * Safely parses and evaluates extracted JSON-LD blocks for schema conformance.
   * Handles objects, arrays, @graph containers, and distinguishes required vs recommended properties.
   */
  validateSchemas(jsonLdArray: any[], options?: { isB2B?: boolean }): ValidatedSchema[] {
    const results: ValidatedSchema[] = [];

    for (const rawItem of jsonLdArray) {
      if (!rawItem) continue;

      let item = rawItem;
      if (typeof rawItem === 'string') {
        try {
          item = JSON.parse(rawItem);
        } catch (parseErr) {
          results.push({
            schemaType: 'INVALID_JSON_LD',
            isValid: false,
            errors: [`Invalid JSON-LD syntax: ${(parseErr as Error).message}`],
            findings: [
              {
                property: 'json-ld',
                message: `Failed to parse JSON-LD block: ${(parseErr as Error).message}`,
                severity: 'HIGH',
                confidence: 'CONFIRMED',
                isRequired: true,
                recommendation: 'Fix JSON syntax errors in <script type="application/ld+json"> tag.',
              },
            ],
            rawJson: rawItem.slice(0, 300),
          });
          continue;
        }
      }

      // Handle top-level array
      if (Array.isArray(item)) {
        results.push(...this.validateSchemas(item, options));
        continue;
      }

      if (typeof item !== 'object' || item === null) continue;

      // Handle @graph wrappers
      if (item['@graph'] && Array.isArray(item['@graph'])) {
        results.push(...this.validateSchemas(item['@graph'], options));
        continue;
      }

      const rawType = item['@type'];
      if (!rawType) {
        results.push({
          schemaType: 'MISSING_TYPE',
          isValid: false,
          errors: ['JSON-LD object is missing "@type" declaration.'],
          findings: [
            {
              property: '@type',
              message: 'JSON-LD object lacks a schema @type property.',
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              isRequired: true,
              recommendation: 'Specify a valid Schema.org @type (e.g., Organization, Product, Article).',
            },
          ],
          rawJson: JSON.stringify(item).slice(0, 300),
        });
        continue;
      }

      const typeStr = Array.isArray(rawType) ? rawType[0] : String(rawType);
      const mappedType = this.supportedTypes[typeStr] || 'OTHER';

      const findings: SchemaFinding[] = [];
      const errors: string[] = [];

      switch (mappedType) {
        case 'ORGANIZATION':
        case 'LOCAL_BUSINESS':
          if (!item.name) {
            findings.push({
              property: 'name',
              message: `${typeStr}: Missing required property "name"`,
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              isRequired: true,
              recommendation: 'Add the official organization or business name.',
            });
          }
          if (!item.url && !item.address) {
            findings.push({
              property: 'url',
              message: `${typeStr}: Recommended to provide "url" or "address"`,
              severity: 'LOW',
              confidence: 'ADVISORY',
              isRequired: false,
              recommendation: 'Include a canonical website URL or postal address.',
            });
          }
          break;

        case 'PRODUCT':
          // Required: name
          if (!item.name) {
            findings.push({
              property: 'name',
              message: 'Product: Missing required property "name"',
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              isRequired: true,
              recommendation: 'Provide the exact product title or model name in the "name" property.',
            });
          }

          // Offers / Price / Quote-based check
          const hasOffers = Boolean(item.offers);
          const hasReviews = Boolean(item.review || item.aggregateRating);

          if (!hasOffers && !hasReviews) {
            if (options?.isB2B) {
              findings.push({
                property: 'offers',
                message: 'Product: Missing "offers" property (acceptable for quote-based B2B items, though needed for rich snippets)',
                severity: 'MEDIUM',
                confidence: 'ADVISORY',
                isRequired: false,
                recommendation: 'For B2B quote products, consider adding an Offer with "priceSpecification" or "eligibleQuantity".',
              });
            } else {
              findings.push({
                property: 'offers',
                message: 'Product: Must provide at least one of "offers", "review", or "aggregateRating" for rich snippets',
                severity: 'HIGH',
                confidence: 'LIKELY',
                isRequired: false,
                recommendation: 'Add product pricing via "offers" or customer review schema to qualify for Google rich results.',
              });
            }
          } else if (hasOffers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (typeof offer === 'object' && offer !== null) {
              if (offer.price === undefined && !offer.priceSpecification) {
                if (options?.isB2B) {
                  findings.push({
                    property: 'offers.price',
                    message: 'Product Offer has no price (B2B quote-based item)',
                    severity: 'LOW',
                    confidence: 'ADVISORY',
                    isRequired: false,
                    recommendation: 'Specify pricing terms or link to quote request page.',
                  });
                } else {
                  findings.push({
                    property: 'offers.price',
                    message: 'Product: Offer is missing "price" or "priceSpecification"',
                    severity: 'HIGH',
                    confidence: 'CONFIRMED',
                    isRequired: true,
                    recommendation: 'Specify numerical "price" and ISO currency code (e.g. "INR", "USD").',
                  });
                }
              }
            }
          }

          // Optional reviews
          if (!hasReviews) {
            findings.push({
              property: 'aggregateRating',
              message: 'Product: Optional "aggregateRating" or "review" is not provided',
              severity: 'LOW',
              confidence: 'ADVISORY',
              isRequired: false,
              recommendation: 'Add customer reviews and ratings to earn star ratings in search snippets.',
            });
          }
          break;

        case 'ARTICLE':
          if (!item.headline) {
            findings.push({
              property: 'headline',
              message: 'Article: Missing required property "headline"',
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              isRequired: true,
              recommendation: 'Add a clear article headline under 110 characters.',
            });
          }
          if (!item.author) {
            findings.push({
              property: 'author',
              message: 'Article: Missing recommended property "author"',
              severity: 'MEDIUM',
              confidence: 'LIKELY',
              isRequired: false,
              recommendation: 'Specify author Person or Organization for E-E-A-T signals.',
            });
          }
          if (!item.datePublished) {
            findings.push({
              property: 'datePublished',
              message: 'Article: Recommended to provide "datePublished"',
              severity: 'LOW',
              confidence: 'ADVISORY',
              isRequired: false,
              recommendation: 'Add ISO 8601 publication date timestamp.',
            });
          }
          break;

        case 'BREADCRUMB':
          if (!item.itemListElement || !Array.isArray(item.itemListElement) || item.itemListElement.length === 0) {
            findings.push({
              property: 'itemListElement',
              message: 'BreadcrumbList: "itemListElement" array is missing or empty',
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              isRequired: true,
              recommendation: 'Populate itemListElement with ordered ListItem entries.',
            });
          } else {
            for (let i = 0; i < item.itemListElement.length; i++) {
              const el = item.itemListElement[i];
              if (!el.position) {
                findings.push({
                  property: `itemListElement[${i}].position`,
                  message: `BreadcrumbList: ListItem #${i + 1} missing "position"`,
                  severity: 'MEDIUM',
                  confidence: 'CONFIRMED',
                  isRequired: true,
                  recommendation: 'Add 1-based sequential position index to each breadcrumb item.',
                });
              }
              if (!el.item && !el.name) {
                findings.push({
                  property: `itemListElement[${i}].name`,
                  message: `BreadcrumbList: ListItem #${i + 1} missing "item" or "name"`,
                  severity: 'MEDIUM',
                  confidence: 'CONFIRMED',
                  isRequired: true,
                  recommendation: 'Provide target URL in "item" and label in "name".',
                });
              }
            }
          }
          break;

        case 'FAQ':
          if (!item.mainEntity || !Array.isArray(item.mainEntity) || item.mainEntity.length === 0) {
            findings.push({
              property: 'mainEntity',
              message: 'FAQPage: "mainEntity" array is missing or empty',
              severity: 'HIGH',
              confidence: 'CONFIRMED',
              isRequired: true,
              recommendation: 'Include Question and Answer objects in mainEntity array.',
            });
          } else {
            for (let i = 0; i < item.mainEntity.length; i++) {
              const q = item.mainEntity[i];
              if (q['@type'] !== 'Question') {
                findings.push({
                  property: `mainEntity[${i}].@type`,
                  message: `FAQPage item #${i + 1} must be of @type "Question"`,
                  severity: 'MEDIUM',
                  confidence: 'CONFIRMED',
                  isRequired: true,
                  recommendation: 'Set @type to "Question".',
                });
              }
              if (!q.name) {
                findings.push({
                  property: `mainEntity[${i}].name`,
                  message: `FAQPage Question #${i + 1} is missing question text in "name"`,
                  severity: 'HIGH',
                  confidence: 'CONFIRMED',
                  isRequired: true,
                  recommendation: 'Set question title or inquiry in "name".',
                });
              }
              if (!q.acceptedAnswer || !q.acceptedAnswer.text) {
                findings.push({
                  property: `mainEntity[${i}].acceptedAnswer.text`,
                  message: `FAQPage Question #${i + 1} is missing "acceptedAnswer.text"`,
                  severity: 'HIGH',
                  confidence: 'CONFIRMED',
                  isRequired: true,
                  recommendation: 'Provide answer text in acceptedAnswer.text.',
                });
              }
            }
          }
          break;
      }

      for (const f of findings) {
        if (f.isRequired || f.severity === 'HIGH') {
          errors.push(f.message);
        }
      }

      results.push({
        schemaType: mappedType,
        isValid: errors.length === 0,
        errors,
        findings,
        rawJson: JSON.stringify(item).slice(0, 500),
      });
    }

    return results;
  }
}
