# Security Incident Response Plan (S-IRP)

## 1. Purpose & Scope
This incident response plan establishes technical and operational protocols for identifying, containing, eradicating, and communicating security incidents affecting the Reigel SaaS platform, customer data, and cloud infrastructure.

---

## 2. Incident Classification Matrix

| Severity Level | Definition | Response SLA | Escalation Target |
| :--- | :--- | :--- | :--- |
| **P0 - Critical** | Active data breach, confirmed unauthorized database access, compromise of production secrets (e.g. Master encryption key, DB root credentials). | Immediate (< 30 minutes) | Lead Engineer, Infrastructure Owner, Legal / DPO |
| **P1 - High** | Remote code execution vulnerability, credential stuffing attack targeting customer accounts, significant service outage. | < 2 hours | Core Engineering Team |
| **P2 - Medium** | Non-exploited vulnerability detected, abnormal rate-limiting spikes, single-account suspicious login activity. | < 8 hours | Security / Backend Engineers |
| **P3 - Low** | Minor dependency alert with no proven attack vector, informational security notice. | < 72 hours | Next development sprint |

---

## 3. Incident Response Lifecycle Phases

### Phase 1: Identification & Triage
- Automated alerts triggered by error trackers, rate-limiting violations, or server anomalies.
- Security disclosures received via `security@reigel.ai` (monitored responsible disclosure mailbox).
- Triage: Determine affected tenant workspaces, impacted data types, and severity level.

### Phase 2: Containment & Isolation
- **Short-Term Containment**:
  - Revoke active user sessions via `RefreshSession` table truncation or selective user invalidation.
  - Rotate compromised third-party credentials (API keys, OAuth client secrets, DB credentials).
  - Enable Cloudflare / WAF IP blocklists or rate-limiting throttles.
  - Temporarily pause worker job queues if anomalous crawler behavior is identified.
- **Long-Term Containment**:
  - Deploy emergency hotfix patches to staging and production.

### Phase 3: Eradication & Remediation
- Identify root cause (e.g. vulnerable dependency, missing authorization check, SSRF vector).
- Implement code-level remediation and add regression unit tests.
- Verify production database integrity using verified database dumps (e.g. `backups/`).

### Phase 4: Recovery & Post-Incident Review
- Restore normal application traffic and monitor telemetry for 72 hours.
- Perform blameless post-mortem analysis documenting timeline, root cause, and systemic mitigations.

---

## 4. Regulatory & Breach Notification Protocol
- **GDPR / Article 33**: If customer PII is compromised, notify relevant supervisory authorities without undue delay and, where feasible, not later than **72 hours** after becoming aware of the breach.
- **Customer Notification**: Impacted workspace owners will receive direct written notification outlining the nature of the breach, affected data categories, and recommended actions.

---

## 5. Responsible Disclosure Protocol
Security researchers are encouraged to report findings responsibly:
- Email: `security@reigel.ai`
- Include reproducible proof-of-concept steps.
- Allow 48 hours for acknowledgment before public disclosure.
- Safe harbor: Reigel commits to not taking legal action against researchers acting in good faith.
