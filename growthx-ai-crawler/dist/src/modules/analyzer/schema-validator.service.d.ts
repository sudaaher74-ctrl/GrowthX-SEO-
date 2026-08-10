export interface ValidatedSchema {
    schemaType: string;
    isValid: boolean;
    errors: string[];
    rawJson: string;
}
export declare class SchemaValidatorService {
    private readonly logger;
    private readonly supportedTypes;
    /**
     * Evaluates extracted JSON-LD and microdata for standard schema presence and structural requirements
     */
    validateSchemas(jsonLdArray: any[]): ValidatedSchema[];
}
