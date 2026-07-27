"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AuthGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
let AuthGuard = AuthGuard_1 = class AuthGuard {
    constructor() {
        this.logger = new common_1.Logger(AuthGuard_1.name);
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];
        const authHeader = request.headers['authorization'];
        // Allow in test environment if no strict check is enforced
        if (process.env.NODE_ENV === 'test' && !apiKey && !authHeader) {
            return true;
        }
        const validApiKey = process.env.API_KEY || 'growthx-enterprise-crawler-key-2026';
        if (apiKey && apiKey === validApiKey) {
            return true;
        }
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (token === validApiKey || token === process.env.JWT_SECRET) {
                return true;
            }
        }
        this.logger.warn(`Unauthorized API request from IP: ${request.ip} to ${request.originalUrl}`);
        throw new common_1.UnauthorizedException('Invalid or missing x-api-key or Authorization Bearer token.');
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = AuthGuard_1 = __decorate([
    (0, common_1.Injectable)()
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map