import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GoogleAuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GoogleAuthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = rawFrontendUrl.replace(/\/+$/, '');

    let errorMessage = 'Google authentication failed. Please try again.';

    const oauthError = (exception as any)?.oauthError;
    if (oauthError) {
      this.logger.error(
        `Google OAuth token error: statusCode=${oauthError.statusCode} data=${JSON.stringify(oauthError.data)}`,
      );
      let details = '';
      if (oauthError.data) {
        try {
          const parsed =
            typeof oauthError.data === 'string'
              ? JSON.parse(oauthError.data)
              : oauthError.data;
          details = parsed.error_description
            ? `${parsed.error_description} (${parsed.error || 'oauth_error'})`
            : parsed.error || String(oauthError.data);
        } catch {
          details = String(oauthError.data);
        }
      }
      errorMessage = details
        ? `Google sign-in error: ${details}`
        : (exception instanceof Error ? exception.message : errorMessage);
    } else if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        errorMessage = resp;
      } else if (typeof resp === 'object' && resp !== null && 'message' in resp) {
        const msg = (resp as any).message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
    } else if (exception instanceof Error) {
      errorMessage = exception.message || errorMessage;
    }

    this.logger.error(
      `Google OAuth redirecting with error: ${errorMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const redirectUrl = `${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`;
    return response.redirect(redirectUrl);
  }
}
