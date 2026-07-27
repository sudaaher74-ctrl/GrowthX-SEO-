"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SecurityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const dns = require("dns");
const axios_1 = require("axios");
const cheerio = require("cheerio");
let SecurityService = SecurityService_1 = class SecurityService {
    constructor() {
        this.logger = new common_1.Logger(SecurityService_1.name);
        this.algorithm = 'aes-256-gcm';
        const keyString = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        // Ensure key is 32 bytes
        if (keyString.length >= 64) {
            this.secretKey = Buffer.from(keyString.substring(0, 64), 'hex');
        }
        else {
            this.secretKey = crypto.createHash('sha256').update(String(keyString)).digest();
        }
    }
    /**
     * Encrypts sensitive customer credentials (e.g., HTTP Basic Auth or session cookie JSON) using AES-256-GCM
     */
    encryptCredentials(plainText) {
        if (!plainText)
            return '';
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }
    /**
     * Decrypts stored customer credentials
     */
    decryptCredentials(encryptedText) {
        if (!encryptedText)
            return '';
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid cipher text structure');
            }
            const [ivHex, authTagHex, encryptedHex] = parts;
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            this.logger.error('Failed to decrypt credentials. Possible key mismatch.', error);
            throw new common_1.UnauthorizedException('Could not decrypt authorization credentials.');
        }
    }
    /**
     * Generates a unique DNS TXT verification token for a domain challenge
     */
    generateVerificationToken(domain) {
        return `growthx-verify-${crypto.randomBytes(16).toString('hex')}`;
    }
    /**
     * Validates if a user/customer owns the domain or has permission to audit it.
     * Checks for a DNS TXT record or HTML meta tag.
     */
    async verifyDomainOwnership(domain, token) {
        this.logger.log(`Verifying ownership of domain ${domain} with token ${token}...`);
        // 1. Try DNS TXT Record check
        try {
            const records = await dns.promises.resolveTxt(domain);
            const flatRecords = records.flat();
            if (flatRecords.some(r => r.includes(`growthx-verification=${token}`) || r.includes(token))) {
                this.logger.log(`Domain ${domain} ownership verified via DNS TXT record.`);
                return true;
            }
        }
        catch (dnsError) {
            this.logger.debug(`DNS TXT verification failed or not found for ${domain}`, dnsError);
        }
        // 2. Try HTML Meta Tag check on homepage
        try {
            const protocol = domain.startsWith('http') ? '' : 'https://';
            const targetUrl = `${protocol}${domain}`;
            const response = await axios_1.default.get(targetUrl, {
                timeout: 5000,
                headers: { 'User-Agent': 'GrowthX-AI-Verifier/1.0' },
            });
            if (response.status === 200 && response.data) {
                const $ = cheerio.load(response.data);
                const metaTag = $('meta[name="growthx-verification"]').attr('content') ||
                    $('meta[name="growthx-site-verification"]').attr('content');
                if (metaTag && metaTag.trim() === token) {
                    this.logger.log(`Domain ${domain} ownership verified via HTML meta tag.`);
                    return true;
                }
            }
        }
        catch (httpError) {
            this.logger.debug(`HTML meta tag verification failed for ${domain}`, httpError);
        }
        this.logger.warn(`Verification failed for domain ${domain} with token ${token}.`);
        return false;
    }
    /**
     * Logs security events and scan authorization attempts
     */
    logAuditActivity(userId, action, targetDomain, status) {
        this.logger.log(`[AUDIT LOG] User: ${userId} | Action: ${action} | Target: ${targetDomain} | Status: ${status} | Timestamp: ${new Date().toISOString()}`);
    }
};
exports.SecurityService = SecurityService;
exports.SecurityService = SecurityService = SecurityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SecurityService);
//# sourceMappingURL=security.service.js.map