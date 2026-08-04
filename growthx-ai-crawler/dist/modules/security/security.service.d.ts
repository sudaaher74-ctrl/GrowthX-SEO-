export declare class SecurityService {
    private readonly logger;
    private readonly algorithm;
    private readonly secretKey;
    constructor();
    /**
     * Encrypts sensitive customer credentials (e.g., HTTP Basic Auth or session cookie JSON) using AES-256-GCM
     */
    encryptCredentials(plainText: string): string;
    /**
     * Decrypts stored customer credentials
     */
    decryptCredentials(encryptedText: string): string;
    /**
     * Generates a unique DNS TXT verification token for a domain challenge
     */
    generateVerificationToken(_domain: string): string;
    /**
     * Validates if a user/customer owns the domain or has permission to audit it.
     * Checks for a DNS TXT record or HTML meta tag.
     */
    verifyDomainOwnership(domain: string, token: string): Promise<boolean>;
    /**
     * Logs security events and scan authorization attempts
     */
    logAuditActivity(userId: string, action: string, targetDomain: string, status: 'SUCCESS' | 'FAILED' | 'BLOCKED'): void;
}
