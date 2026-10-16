/** Customer-safe categories only: never echo provider payloads, prompts or credentials. */
export function providerFailureReason(error: unknown): string {
  const value = error as { status?: number; code?: number; message?: string };
  const status = value?.status ?? value?.code;
  const text = value?.message?.toLowerCase() ?? '';
  if (status === 404 || text.includes('no longer available') || text.includes('model is unavailable'))
    return 'The configured model is unavailable. Check the approved model routing before retrying.';
  if (status === 401 || status === 403)
    return 'The provider rejected account access. Check its credentials and model permissions.';
  if (status === 429)
    return 'The provider rate or quota limit was reached. Check quota before retrying.';
  if (text.includes('budget') || text.includes('spending') || text.includes('limit is reached'))
    return 'The configured spending limit was reached. Review usage before retrying.';
  if (text.includes('timeout') || text.includes('timed out') || text.includes('abort'))
    return 'The provider request timed out. Saved answers are retained; review provider availability before retrying.';
  return 'The provider request did not complete. Check its access, quota and availability before retrying.';
}
