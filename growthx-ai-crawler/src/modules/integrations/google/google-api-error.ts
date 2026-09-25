import { BadGatewayException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';

const API_DISABLED = /has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i;

/**
 * The error a picker request should throw when Google refuses it.
 *
 * Rethrowing the raw googleapis error reached the customer as a bare
 * "Internal server error", which says nothing about the two causes that
 * account for nearly every failure here and need opposite fixes: the API is
 * switched off on this deployment's Cloud project (an operator fixes it once,
 * reconnecting cannot), or the authorization is missing a scope (reconnecting
 * is exactly the fix). Status codes avoid 401, which the web client treats as
 * a signed-out session, and 5xx for the configuration case, which it retries.
 */
export function googleApiClientError(apiName: string, error: any): HttpException {
  const status = error?.response?.status ?? error?.code;
  const raw: string = error?.response?.data?.error?.message ?? error?.message ?? '';

  if ((status === 401 || status === 403) && API_DISABLED.test(raw)) {
    return new HttpException(
      `The ${apiName} is not enabled on this app's Google Cloud project, so Google refused the request. ` +
        `Whoever manages the Google Cloud project must enable "${apiName}" under APIs & Services → Library, ` +
        'wait a few minutes, then try again. Reconnecting your Google account will not fix this.',
      HttpStatus.FAILED_DEPENDENCY,
    );
  }

  if (status === 401 || status === 403) {
    return new ForbiddenException(
      `Google refused access to the ${apiName} (${status}). Reconnect Google and accept every permission on ` +
        "the consent screen; if it persists, make sure the Google account you signed in with has access.",
    );
  }

  // Google's own message field carries no token or credential.
  return new BadGatewayException(
    raw ? `Google could not answer the ${apiName} request: ${raw.slice(0, 300)}` : `Google could not answer the ${apiName} request.`,
  );
}
