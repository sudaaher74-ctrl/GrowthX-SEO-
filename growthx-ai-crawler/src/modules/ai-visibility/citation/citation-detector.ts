export function normalizeDomain(domain: string): string {
  try {
    const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return domain.replace(/^www\./, '');
  }
}
