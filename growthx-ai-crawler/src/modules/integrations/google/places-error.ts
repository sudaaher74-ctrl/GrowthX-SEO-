/**
 * Turns a Google error body into the sentence that names the actual fix.
 *
 * Google's `error.message` for a 403 is "The caller does not have permission",
 * which is true of four unrelated misconfigurations and tells an operator
 * nothing about which one they have. The machine-readable cause is in
 * `error.details[].reason`, and `metadata.consumer` names the Cloud project
 * Google actually billed the call to — the detail that catches a key belonging
 * to a different project from the one the operator has been configuring.
 * Both were being discarded.
 *
 * The key itself is never included: this string reaches the browser.
 */
export function describePlacesFailure(parsed: any): string {
  const info = (parsed?.error?.details ?? []).find(
    (detail: any) => typeof detail?.reason === 'string',
  );
  if (!info) return '';

  const remedy: Record<string, string> = {
    SERVICE_DISABLED:
      'Places API (New) is not enabled on that project — note it is a separate API from the legacy Places API.',
    API_KEY_SERVICE_BLOCKED:
      "The API key's restrictions exclude Places API (New). Add it under the key's API restrictions.",
    API_KEY_HTTP_REFERRER_BLOCKED:
      'The API key is restricted to browser referrers, but this call comes from the server. Use a key with no referrer restriction.',
    API_KEY_IP_ADDRESS_BLOCKED:
      "The API key is IP-restricted and this deployment's address is not on the list.",
    API_KEY_INVALID: 'The API key is not valid for this request.',
    BILLING_DISABLED: 'Billing is not enabled on that project, which Places requires.',
  };

  const consumer = info.metadata?.consumer;
  const project = typeof consumer === 'string' ? consumer.replace(/^projects\//, '') : null;

  return [
    ` [${info.reason}`,
    project ? ` on project ${project}` : '',
    '] ',
    remedy[info.reason] ?? 'See the Google Cloud console for this project.',
  ].join('');
}
