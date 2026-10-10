/** Rolling browser session; normal activity renews it. Account revocation still applies. */
export function refreshLifetimeDays(): number {
  const parsed = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '365', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : 365;
}
