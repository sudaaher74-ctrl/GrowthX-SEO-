"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SchemaValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaValidatorService = void 0;
const common_1 = require("@nestjs/common");
let SchemaValidatorService = SchemaValidatorService_1 = class SchemaValidatorService {
    constructor() {
        this.logger = new common_1.Logger(SchemaValidatorService_1.name);
        this.supportedTypes = {
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
    }
    /**
     * Evaluates extracted JSON-LD and microdata for standard schema presence and structural requirements
     */
    validateSchemas(jsonLdArray) {
        const results = [];
        for (const item of jsonLdArray) {
            if (!item || typeof item !== 'object')
                continue;
            // Handle @graph wrappers
            if (item['@graph'] && Array.isArray(item['@graph'])) {
                results.push(...this.validateSchemas(item['@graph']));
                continue;
            }
            const rawType = item['@type'];
            if (!rawType)
                continue;
            const typeStr = Array.isArray(rawType) ? rawType[0] : String(rawType);
            const mappedType = this.supportedTypes[typeStr] || 'OTHER';
            const errors = [];
            let isValid = true;
            // Structural validations by schema type
            switch (mappedType) {
                case 'ORGANIZATION':
                case 'LOCAL_BUSINESS':
                    if (!item.name)
                        errors.push(`${typeStr}: Missing required property "name"`);
                    if (!item.url && !item.address)
                        errors.push(`${typeStr}: Recommended to provide "url" or "address"`);
                    break;
                case 'PRODUCT':
                    if (!item.name)
                        errors.push('Product: Missing required property "name"');
                    if (!item.offers && !item.review && !item.aggregateRating) {
                        errors.push('Product: Must provide at least one of "offers", "review", or "aggregateRating"');
                    }
                    if (item.offers && !item.offers.price && !item.offers.priceSpecification) {
                        errors.push('Product: Offer is missing "price" or "priceSpecification"');
                    }
                    break;
                case 'ARTICLE':
                    if (!item.headline)
                        errors.push('Article: Missing required property "headline"');
                    if (!item.author)
                        errors.push('Article: Missing required property "author"');
                    if (!item.datePublished)
                        errors.push('Article: Recommended to provide "datePublished"');
                    break;
                case 'BREADCRUMB':
                    if (!item.itemListElement || !Array.isArray(item.itemListElement) || item.itemListElement.length === 0) {
                        errors.push('BreadcrumbList: "itemListElement" array is missing or empty');
                    }
                    else {
                        for (const el of item.itemListElement) {
                            if (!el.position)
                                errors.push('BreadcrumbList: ListItem missing "position"');
                            if (!el.item && !el.name)
                                errors.push('BreadcrumbList: ListItem missing "item" or "name"');
                        }
                    }
                    break;
                case 'FAQ':
                    if (!item.mainEntity || !Array.isArray(item.mainEntity) || item.mainEntity.length === 0) {
                        errors.push('FAQPage: "mainEntity" array is missing or empty');
                    }
                    else {
                        for (const q of item.mainEntity) {
                            if (q['@type'] !== 'Question')
                                errors.push('FAQPage: mainEntity items must be of @type "Question"');
                            if (!q.name)
                                errors.push('FAQPage: Question missing "name" (the question text)');
                            if (!q.acceptedAnswer || !q.acceptedAnswer.text) {
                                errors.push('FAQPage: Question missing "acceptedAnswer.text"');
                            }
                        }
                    }
                    break;
                case 'REVIEW':
                    if (!item.reviewRating && !item.ratingValue)
                        errors.push('Review: Missing "reviewRating" or "ratingValue"');
                    if (!item.author)
                        errors.push('Review: Missing "author" property');
                    break;
                case 'VIDEO':
                    if (!item.name)
                        errors.push('VideoObject: Missing required property "name"');
                    if (!item.description)
                        errors.push('VideoObject: Missing required property "description"');
                    if (!item.thumbnailUrl && !item.thumbnail)
                        errors.push('VideoObject: Missing required property "thumbnailUrl"');
                    if (!item.uploadDate)
                        errors.push('VideoObject: Missing required property "uploadDate"');
                    break;
                case 'RECIPE':
                    if (!item.name)
                        errors.push('Recipe: Missing required property "name"');
                    if (!item.recipeIngredient || !Array.isArray(item.recipeIngredient)) {
                        errors.push('Recipe: Missing or invalid "recipeIngredient" array');
                    }
                    if (!item.recipeInstructions)
                        errors.push('Recipe: Missing required property "recipeInstructions"');
                    break;
                case 'EVENT':
                    if (!item.name)
                        errors.push('Event: Missing required property "name"');
                    if (!item.startDate)
                        errors.push('Event: Missing required property "startDate"');
                    if (!item.location)
                        errors.push('Event: Missing required property "location"');
                    break;
            }
            if (errors.length > 0) {
                isValid = false;
            }
            results.push({
                schemaType: mappedType,
                isValid,
                errors,
                rawJson: JSON.stringify(item),
            });
        }
        return results;
    }
};
exports.SchemaValidatorService = SchemaValidatorService;
exports.SchemaValidatorService = SchemaValidatorService = SchemaValidatorService_1 = __decorate([
    (0, common_1.Injectable)()
], SchemaValidatorService);
//# sourceMappingURL=schema-validator.service.js.map