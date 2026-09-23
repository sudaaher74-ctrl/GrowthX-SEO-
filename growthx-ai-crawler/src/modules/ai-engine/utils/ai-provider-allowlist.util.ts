import { ConfigService } from '@nestjs/config';

/**
 * The vendors this deployment may call, from `AI_PROVIDERS` (comma-separated,
 * e.g. `AI_PROVIDERS=SARVAM`).
 *
 * A key being present is not the same as a decision to use that vendor: an
 * operator who standardises on one provider should not have to delete every
 * other key to stop the router from reaching them. Null means no restriction —
 * every vendor with a key is available, as before this setting existed.
 */
export function readProviderAllowlist(config: ConfigService): ReadonlySet<string> | null {
  const raw = config.get<string>('AI_PROVIDERS');
  if (!raw?.trim()) return null;
  const names = raw
    .split(',')
    .map((name) => name.trim().toUpperCase())
    .filter(Boolean);
  return names.length > 0 ? new Set(names) : null;
}

/** Whether `provider` (any case) may be called under the allowlist. */
export function isProviderAllowed(allowlist: ReadonlySet<string> | null, provider: string): boolean {
  return allowlist === null || allowlist.has(provider.toUpperCase());
}
