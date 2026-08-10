"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const tls = require("tls");
const url = require("url");
let ValidatorService = ValidatorService_1 = class ValidatorService {
    constructor() {
        this.logger = new common_1.Logger(ValidatorService_1.name);
    }
    /**
     * Validates a domain for reachability, HTTPS support, SSL certificate health, and redirect behavior.
     * Module 1 Requirement: If unreachable, return error.
     */
    async validateWebsite(targetDomainOrUrl) {
        this.logger.log(`Starting website validation for: ${targetDomainOrUrl}`);
        let formattedUrl = targetDomainOrUrl.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = `https://${formattedUrl}`;
        }
        const parsedUrl = url.parse(formattedUrl);
        const hostname = parsedUrl.hostname || targetDomainOrUrl;
        const result = {
            isReachable: false,
            isHttps: formattedUrl.startsWith('https://'),
            sslValid: false,
            redirectChain: [],
        };
        // 1. Check SSL Certificate health if HTTPS
        if (result.isHttps && hostname) {
            try {
                const sslInfo = await this.checkSslCertificate(hostname, parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443);
                result.sslValid = sslInfo.valid;
                result.sslExpiryDate = sslInfo.expiryDate;
            }
            catch (sslErr) {
                this.logger.warn(`SSL check failed for ${hostname}`, sslErr);
                result.sslValid = false;
            }
        }
        // 2. Check Reachability and Redirect Chain
        try {
            const redirectChain = [formattedUrl];
            const response = await axios_1.default.get(formattedUrl, {
                timeout: 10000,
                maxRedirects: 10,
                validateStatus: () => true, // Accept any status code to inspect reachability
                headers: {
                    'User-Agent': process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
                },
            });
            const finalUrl = response.request?.res?.responseUrl || formattedUrl;
            if (finalUrl !== formattedUrl && !redirectChain.includes(finalUrl)) {
                redirectChain.push(finalUrl);
            }
            result.isReachable = response.status >= 200 && response.status < 500;
            result.statusCode = response.status;
            result.redirectChain = redirectChain;
            result.finalUrl = finalUrl;
            if (!result.isReachable) {
                result.errorMessage = `Website returned HTTP status code ${response.status}. Considered unreachable for crawling.`;
            }
            this.logger.log(`Validation completed for ${hostname}: Reachable=${result.isReachable}, Status=${result.statusCode}, SSL=${result.sslValid}`);
        }
        catch (httpErr) {
            this.logger.error(`Website unreachable: ${formattedUrl}`, httpErr.message);
            result.isReachable = false;
            result.errorMessage = `Website unreachable: ${httpErr.message || 'Connection timeout or network failure.'}`;
        }
        return result;
    }
    /**
     * Inspects SSL/TLS certificate via raw socket connection
     */
    checkSslCertificate(hostname, port = 443) {
        return new Promise((resolve, reject) => {
            const socket = tls.connect(port, hostname, { servername: hostname, rejectUnauthorized: false }, () => {
                try {
                    const cert = socket.getPeerCertificate();
                    if (!cert || !cert.valid_to) {
                        socket.end();
                        return resolve({ valid: false });
                    }
                    const expiryDate = new Date(cert.valid_to);
                    const now = new Date();
                    const valid = socket.authorized && expiryDate > now;
                    socket.end();
                    resolve({ valid, expiryDate });
                }
                catch (err) {
                    socket.end();
                    reject(err);
                }
            });
            socket.on('error', (err) => {
                reject(err);
            });
            socket.setTimeout(5000, () => {
                socket.destroy();
                reject(new Error('SSL check socket timed out'));
            });
        });
    }
};
exports.ValidatorService = ValidatorService;
exports.ValidatorService = ValidatorService = ValidatorService_1 = __decorate([
    (0, common_1.Injectable)()
], ValidatorService);
//# sourceMappingURL=validator.service.js.map