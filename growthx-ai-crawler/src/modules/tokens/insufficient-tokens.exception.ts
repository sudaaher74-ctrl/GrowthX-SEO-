import { HttpException, HttpStatus } from '@nestjs/common';

/** The `error` a client matches on. Part of the API: the dashboard reads this exact string. */
export const INSUFFICIENT_TOKENS = 'INSUFFICIENT_TOKENS';

export interface InsufficientTokensDetail {
  /** What the work needed — or, for a gate, the least that lets it start. */
  required: number;
  /** What the workspace holds now, across both buckets. */
  available: number;
  /** When the monthly allowance next refills. */
  resetsAt: Date;
}

/**
 * 402 Payment Required, with a body a screen can act on.
 *
 * Deliberately not a 403: the dashboard treats 403 as "you may not do this" and
 * this is "you may, once there are tokens", which asks for a different message
 * and a different next step. The text is written for a business owner, not an
 * engineer, because it is shown as-is wherever a caller lets it through.
 */
export class InsufficientTokensException extends HttpException {
  constructor(readonly detail: InsufficientTokensDetail) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: INSUFFICIENT_TOKENS,
        message: insufficientTokensMessage(detail),
        required: detail.required,
        available: detail.available,
        resetsAt: detail.resetsAt.toISOString(),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

export function isInsufficientTokens(error: unknown): error is InsufficientTokensException {
  return error instanceof InsufficientTokensException;
}

function insufficientTokensMessage({ required, available, resetsAt }: InsufficientTokensDetail): string {
  const refills = resetsAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const remedy = `Tokens refill on ${refills}, or an administrator can add more.`;

  if (available <= 0) {
    return `This workspace has used all of its tokens for this month. ${remedy}`;
  }
  return (
    `This needs ${required.toLocaleString('en-US')} tokens and the workspace has ` +
    `${available.toLocaleString('en-US')} left. ${remedy}`
  );
}
