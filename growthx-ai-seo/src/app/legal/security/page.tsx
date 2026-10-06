import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Architecture",
  description:
    "How Reigel AI SEO protects customer data, scopes multi-tenant access, encrypts integration credentials, and defends against server-side request forgery.",
};

const LAST_UPDATED = "6 October 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-brand-300">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <article>
      <h1 className="text-2xl font-bold tracking-tight text-white">Security Architecture &amp; Controls</h1>
      <p className="mt-2 text-sm text-brand-500">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-sm leading-relaxed text-brand-300">
        Reigel AI SEO provides technical SEO, crawl diagnostics, and search intelligence. Because our platform interacts with client websites, Google APIs, and third-party AI systems, we implement defense-in-depth security engineering across all layers of our application.
      </p>

      <Section id="transport" title="Secure Transport &amp; Headers">
        <p>
          All web and API traffic is encrypted in transit using Transport Layer Security (TLS 1.2+). Production endpoints enforce HTTP Strict Transport Security (HSTS), <code>X-Content-Type-Options: nosniff</code>, <code>X-Frame-Options: DENY</code>, and restrictive permissions policies.
        </p>
      </Section>

      <Section id="authentication" title="Authentication &amp; Session Management">
        <p>
          User passwords are encrypted with salted <code>bcrypt</code> hashes. Browser authentication sessions use hardened, <code>HttpOnly</code> cookies flagged with <code>Secure</code> and appropriate <code>SameSite</code> protections, ensuring tokens are inaccessible to JavaScript context.
        </p>
        <p>
          Mutating requests enforce Double-Submit Cookie CSRF defenses and verify origin authenticity. Refresh tokens rotate upon consumption, and token reuse triggers automatic revocation of active refresh sessions.
        </p>
      </Section>

      <Section id="tenant-isolation" title="Multi-Tenant Isolation">
        <p>
          Data is strictly segregated by organization and project. All API operations authenticate principals server-side and verify organization membership. Database queries enforce tenant boundaries, ensuring users cannot access or tamper with data belonging to other workspaces.
        </p>
      </Section>

      <Section id="credentials" title="Integration Credential Encryption">
        <p>
          OAuth access and refresh tokens for third-party services (such as Google Search Console, Google Analytics 4, and Google Business Profile) are encrypted at rest using AES-256-GCM. Encryption uses unique nonces and cryptographic authentication tags. Plaintext integration tokens are never logged or exposed to the client.
        </p>
      </Section>

      <Section id="crawler-ssrf" title="Crawler SSRF &amp; Network Defense">
        <p>
          Our automated website crawler is fortified against Server-Side Request Forgery (SSRF) and DNS rebinding:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Refusal of private, local, loopback, and carrier-grade IPv4/IPv6 address blocks (including <code>127.0.0.1</code>, <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>, <code>::1</code>, and unique local addresses).</li>
          <li>Refusal of cloud metadata addresses (including <code>169.254.169.254</code>).</li>
          <li>Real-time DNS socket resolution validation before connection and on every redirect hop.</li>
          <li>Strict protocol restriction accepting only <code>http:</code> and <code>https:</code>.</li>
        </ul>
      </Section>

      <Section id="rate-limiting" title="Rate Limiting &amp; Crawler Politeness">
        <p>
          API surfaces are protected by rate limiters to guard against abuse and credential attacks. The crawler honors site <code>robots.txt</code> directives, enforces concurrency bounds, and spaces requests politely.
        </p>
      </Section>

      <Section id="code-sandbox" title="Repository &amp; Code Fix Safety">
        <p>
          Any future code fix proposals operate on a strict human-in-the-loop model: code fixes generate pull requests for human review on GitHub. Fixes are never automatically merged or pushed directly to production branches. Repository contents are treated strictly as untrusted data.
        </p>
      </Section>

      <Section id="reporting" title="Vulnerability Disclosure &amp; Reporting">
        <p>
          We welcome responsible disclosure of security vulnerabilities. If you believe you have discovered a security issue, please contact:
        </p>
        <p className="p-3 rounded-lg border border-brand-800 bg-brand-900/40 font-mono text-xs text-brand-300">
          TODO: BUSINESS OWNER INPUT REQUIRED (e.g., security@reigel.ai)
        </p>
        <p>
          Please include steps to reproduce, affected endpoints, and allow reasonable time for remediation before public disclosure.
        </p>
      </Section>
    </article>
  );
}
