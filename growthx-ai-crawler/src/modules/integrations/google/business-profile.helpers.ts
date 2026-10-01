/**
 * What a Google failure means for the customer, and for the connection row.
 */
export type FailureKind =
  | 'REAUTH'
  | 'PENDING_APPROVAL'
  | 'QUOTA_NOT_GRANTED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'OTHER';

export interface ClassifiedFailure {
  kind: FailureKind;
  httpStatus: number | null;
  /** Safe to show: never a token, never a raw payload. */
  message: string;
}

/**
 * Everything Google attached to a failure, from either transport.
 *
 * The SDK clients put the parsed body on `response.data`; the v4 helper has no
 * SDK, so it attaches the same object as `googleError`. Both are read here so
 * the two paths classify identically.
 */
export function googleErrorDetails(error: any): any[] {
  const payload = error?.response?.data?.error ?? error?.googleError ?? null;
  return Array.isArray(payload?.details) ? payload.details : [];
}

/**
 * Whether a 429 is a quota of zero rather than a burst.
 *
 * This is the distinction that decides whether waiting is the advice. A Cloud
 * project that has not been granted Business Profile access does not get a
 * 403: the APIs enable fine and answer every request with
 * RESOURCE_EXHAUSTED, because the per-minute quota they are provisioned with
 * is 0 until Google approves the access request. The number is in the
 * structured error, as `quota_limit_value` on the ErrorInfo detail, and it is
 * the only thing that separates "approved and briefly busy" from "not
 * approved, and no amount of waiting or retrying will change that".
 */
export function quotaLimitIsZero(error: any): boolean {
  for (const detail of googleErrorDetails(error)) {
    const value = detail?.metadata?.quota_limit_value ?? detail?.metadata?.quotaLimitValue;
    if (value !== undefined && value !== null && Number(value) === 0) return true;
  }
  // The v4 path can reduce a body to text before anything parses it, so the
  // same fact is accepted in the message it came wrapped in.
  const raw: string = error?.response?.data?.error?.message ?? error?.message ?? '';
  return /quota_limit_value["'\s:]+["']?0\b/i.test(raw);
}

/**
 * What a Google failure means, in words the customer can act on.
 *
 * The distinction that matters most is 401 from 403. A 401 is a grant that
 * is gone and a reconnect fixes it. A 403 on Business Profile is almost
 * always the Cloud project not yet being approved for these APIs — a wait,
 * not a reconnect — and telling someone to reconnect sends them round a loop
 * that cannot terminate.
 */
export function classifyFailure(error: any): ClassifiedFailure {
  const httpStatus: number | null =
    error?.status ?? error?.response?.status ?? (typeof error?.code === 'number' ? error.code : null);
  const raw: string = error?.response?.data?.error?.message ?? error?.message ?? '';

  if (httpStatus === 401) {
    return {
      kind: 'REAUTH',
      httpStatus,
      message:
        'Google rejected the stored authorization for this Business Profile. Reconnect Google Business Profile ' +
        'to resume reading it.',
    };
  }

  if (httpStatus === 403) {
    if (/has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(raw)) {
      return {
        kind: 'PENDING_APPROVAL',
        httpStatus,
        message:
          'Business Profile API access is pending Google’s approval for this Cloud project. The API is not ' +
          'enabled yet, so no profile data can be read. This is granted by Google per project and is not something ' +
          'reconnecting will fix.',
      };
    }
    return {
      kind: 'PENDING_APPROVAL',
      httpStatus,
      message:
        'Google refused this Business Profile request (403). The usual cause is that this Cloud project has not ' +
        'been approved for the Business Profile APIs, which Google grants per project and can take weeks; the ' +
        'other is that the connected Google account does not manage this location.',
    };
  }

  if (httpStatus === 404) {
    return {
      kind: 'NOT_FOUND',
      httpStatus,
      message: 'Google no longer has this location, or it has moved to another account. Re-select the location.',
    };
  }

  if (httpStatus === 429) {
    // Google's answer to an unapproved Cloud project, and the reason this
    // branch cannot simply say "wait a minute": the quota is zero, so there
    // is no minute at which it succeeds.
    if (quotaLimitIsZero(error)) {
      return {
        kind: 'QUOTA_NOT_GRANTED',
        httpStatus,
        message:
          'Google is allowing this deployment zero Business Profile requests per minute, which is what an ' +
          'unapproved Cloud project is given rather than what a busy one is given. Waiting and retrying cannot ' +
          'change it: the Business Profile API access request for this Cloud project has to be approved by ' +
          'Google, which raises the quota above zero. Nothing about the Google account you signed in with is ' +
          'wrong, and reconnecting will not help. Track this location via Places / Manual Entry until the ' +
          'approval lands.',
      };
    }
    return {
      kind: 'RATE_LIMITED',
      httpStatus,
      message:
        'Google is temporarily rate-limiting Business Profile requests for this project. ' +
        'Automatic retries were attempted but Google is still busy. ' +
        'Please wait a minute and click "Try again" — this usually resolves on its own.' +
        // Google names the quota and the service it applies to, which is the
        // only way for whoever runs this deployment to check the limit in
        // Cloud Console rather than guess at it. As in the OTHER branch:
        // Google's message field, which carries no token and no credential.
        (raw ? ` Google said: ${raw.slice(0, 300)}` : ''),
    };
  }

  return {
    kind: 'OTHER',
    httpStatus,
    // Truncated and taken from Google's own message field, which carries no
    // token and no credential.
    message: raw ? `Google could not answer this Business Profile request: ${raw.slice(0, 300)}` : 'Google could not answer this Business Profile request.',
  };
}

/** A single line for display. Null when Google gave no address at all. */
export function formatAddress(address: any): string | null {
  if (!address) return null;
  const parts = [
    ...(address.addressLines ?? []),
    address.locality,
    address.administrativeArea,
    address.postalCode,
    address.regionCode,
  ].filter((part: unknown) => typeof part === 'string' && part.trim().length > 0);
  return parts.length ? parts.join(', ') : null;
}

/** Google's Date type as an ISO-ish string, without inventing missing parts. */
export function formatDate(date: any): string | null {
  if (!date || !date.year) return null;
  const month = date.month ? String(date.month).padStart(2, '0') : null;
  const day = date.day ? String(date.day).padStart(2, '0') : null;
  if (month && day) return `${date.year}-${month}-${day}`;
  if (month) return `${date.year}-${month}`;
  return String(date.year);
}

/** A datapoint's date. Null when it is not a whole day, which cannot be stored. */
export function pointDate(date: any): Date | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

export function utcDay(input: Date): Date {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function parseTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Google's star rating is a word, not a number.
 *
 * STAR_RATING_UNSPECIFIED has no numeric meaning, so it becomes 0 rather than
 * a guess — a review whose rating Google would not state must not be averaged
 * in as though it were three stars.
 */
export function starRating(value: unknown): number {
  switch (value) {
    case 'ONE':
      return 1;
    case 'TWO':
      return 2;
    case 'THREE':
      return 3;
    case 'FOUR':
      return 4;
    case 'FIVE':
      return 5;
    default:
      return 0;
  }
}
