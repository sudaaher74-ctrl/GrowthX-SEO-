# Google Search Console Integration & Security Policy

## 1. Overview
Reigel integrates with Google Search Console (GSC) to provide verified organic search performance analytics, keyword rankings, impressions, clicks, click-through rates (CTR), and URL indexing status.

---

## 2. OAuth 2.0 Scopes & Justifications

Reigel strictly requests read-only permissions necessary to pull diagnostic search analytics:

| Requested Scope | Purpose & Justification |
| :--- | :--- |
| `https://www.googleapis.com/auth/webmasters.readonly` | Read-only access to view Search Console data (queries, impressions, clicks, sitemaps, URL inspect status). Reigel cannot modify DNS, verify ownership, or alter Search Console settings. |

*Reigel does NOT request write access, Gmail access, Google Drive access, or broad profile access.*

---

## 3. Token Security & Storage

### 3.1 Encryption at Rest
- Access tokens and refresh tokens returned by Google are **never stored in plaintext**.
- All tokens are encrypted using **AES-256-GCM** with unique initialization vectors (IV) via `SecurityService`.
- Encryption keys (`ENCRYPTION_KEY` / `INTEGRATION_KEY`) are managed via environment variables and never logged.

### 3.2 Token Lifecycle & Revocation
- **Refresh Flow**: Access tokens are refreshed automatically upon expiry without user re-authentication.
- **Revocation on Disconnect**: When a user disconnects their GSC account or deletes a project/account:
  1. The backend issues a synchronous revocation POST request to Google:
     `https://oauth2.googleapis.com/revoke?token=<refreshToken>`
  2. The integration record (`GscIntegration`) is permanently deleted from the database.
  3. No lingering access grants remain valid with Google.

---

## 4. Google API Limited Use Compliance
Reigel adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements:
1. Reigel only uses Google user data to provide or improve user-facing features that are prominent in the Reigel interface.
2. Reigel does not transfer this data to third parties unless necessary to provide the service, comply with applicable laws, or as part of a merger/acquisition with user consent.
3. Reigel does not use or transfer Google user data for serving advertisements, including personalized, re-targeted, or interest-based advertising.
4. Human access to Google user data is strictly prohibited unless the user has provided explicit permission for troubleshooting, security investigations, or as required by law.
