/**
 * Optional integration credentials, read one way everywhere.
 *
 * Unlike the secrets in `secrets.ts`, these may be absent: the feature that
 * needs one reports itself unavailable and the rest of the product carries on.
 * That only works if every part of the code agrees on what "absent" means. It
 * did not. The health report required a key longer than 20 characters, one
 * router rejected only a few placeholder prefixes, and the Instagram paths
 * accepted any non-empty string. `INSTAGRAM_ACCESS_TOKEN=your_token_here`
 * therefore switched on a daily sync that failed on every run, while /health
 * said Instagram was not configured.
 *
 * A value counts as configured when, trimmed, it is non-empty and is not one of
 * the placeholders that `.env.example` files and dashboards are left holding.
 */

const PLACEHOLDER_PATTERNS = [
  /^(your|add|enter|insert|replace|put)[_\- ]/i, // your_openai_api_key_here, add-your-key
  /^(changeme|change[_-]me|replace[_-]?me|placeholder|dummy|example|sample|todo|tbd|xxx+)$/i,
  /^(none|null|undefined|false|disabled|off|n\/a|-)$/i,
  /^<.*>$/, // <your-key>
  /\*\*\*/, // a masked value pasted back in: sk-***abcd
  /^rzp_(test|live)_your/i, // rzp_test_your_key_id
];

/** Whether an environment value holds a real credential rather than nothing or a placeholder. */
export function isConfiguredValue(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * The trimmed value when it is configured, otherwise undefined.
 *
 * Trimmed because a key pasted into a dashboard often carries a trailing
 * newline, and an SDK sends that verbatim and is refused as unauthorised.
 */
export function configuredValue(value: string | null | undefined): string | undefined {
  return isConfiguredValue(value) ? value.trim() : undefined;
}

export interface InstagramCredentials {
  accessToken: string;
  businessAccountId: string;
}

/**
 * The platform Instagram account competitor lookups run from, or undefined.
 *
 * Both or neither: the token authorises, and the account id is the Instagram
 * Business account the Business Discovery query runs from. The id is numeric,
 * and a value that is not (a username, a URL) cannot be queried, so it counts
 * as unset rather than failing every sync against the Graph API.
 */
export function instagramCredentials(env: NodeJS.ProcessEnv = process.env): InstagramCredentials | undefined {
  const accessToken = configuredValue(env.INSTAGRAM_ACCESS_TOKEN);
  const businessAccountId = configuredValue(env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
  if (!accessToken || !businessAccountId || !/^\d+$/.test(businessAccountId)) return undefined;
  return { accessToken, businessAccountId };
}
