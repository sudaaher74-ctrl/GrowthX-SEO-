export interface ValidationResult {
    isReachable: boolean;
    statusCode?: number;
    isHttps: boolean;
    sslValid: boolean;
    sslExpiryDate?: Date;
    redirectChain: string[];
    finalUrl?: string;
    errorMessage?: string;
}
export declare class ValidatorService {
    private readonly logger;
    /**
     * Validates a domain for reachability, HTTPS support, SSL certificate health, and redirect behavior.
     * Module 1 Requirement: If unreachable, return error.
     */
    validateWebsite(targetDomainOrUrl: string): Promise<ValidationResult>;
    /**
     * Inspects SSL/TLS certificate via raw socket connection
     */
    private checkSslCertificate;
}
