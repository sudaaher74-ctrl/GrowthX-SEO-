import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;
    const authHeader = request.headers['authorization'] as string;

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
    throw new UnauthorizedException('Invalid or missing x-api-key or Authorization Bearer token.');
  }
}
