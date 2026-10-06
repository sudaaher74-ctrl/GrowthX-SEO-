# Data Inventory & Classification Matrix

## 1. Overview
This document categorizes all personal, organization, customer, and telemetry data ingested, processed, and stored across Reigel / GrowthX.

| Classification Level | Definition | Handling & Protection |
| :--- | :--- | :--- |
| **Confidential / Secret** | Authentication credentials, OAuth tokens, API keys, password hashes. | AES-256-GCM encryption at rest, memory scrubbing, never returned in API payloads. |
| **Personal Identifiable (PII)** | User identity, email addresses, names, avatars, IP addresses. | Stored with strict tenant isolation, anonymized on account deletion, audited. |
| **Customer Business Data** | Websites, keywords, search console queries, competitor definitions. | Scoped to Workspace/Project; hard-deleted upon project/account removal. |
| **Derived & Operational** | Crawl telemetry, Lighthouse scores, SEO audit recommendations. | Associated with projects and jobs; ephemeral queues managed by Redis/BullMQ. |

---

## 2. Ingested Data Attributes

### 2.1 User & Authentication
- **Entities**: `User`, `RefreshSession`, `LoginCode`
- **Fields Collected**:
  - `email` (PII): Account identity, notification target.
  - `name` (PII): Display name.
  - `passwordHash` (Confidential): Scrypt/Bcrypt salted hash; never stored in plaintext.
  - `avatarUrl`: User profile picture URL.
  - `role`: Role-based access control tier (`OWNER`, `ADMIN`, `MEMBER`).
  - `ipAddress`, `userAgent` (Audit / Telemetry): Captured in `AuditLog` and `RefreshSession` for security monitoring.

### 2.2 Organization & Tenancy
- **Entities**: `Organization`, `OrganizationMember`, `TokenTransaction`
- **Fields Collected**:
  - `name`: Organization / team display name.
  - `slug`: URL slug for workspace access.
  - `billingTier` / `tokenBalance`: Usage metering and subscription allowance.
  - `auditLogs`: Action logs tracking tenant modifications.

### 2.3 Customer SEO & Crawl Data
- **Entities**: `Project`, `Website`, `CrawlJob`, `Page`, `TechnicalIssue`
- **Fields Collected**:
  - Target domains and project settings.
  - Crawled URLs, response status codes, page titles, meta descriptions, canonical URLs, headings, HTML snippets, DOM depth, schema markup.
  - Core Web Vitals telemetry (LCP, CLS, INP, FCP, TTFB).
  - Competitor domains and tracked keyword portfolios.

### 2.4 Third-Party Integrations
- **Entities**: `GscIntegration`, `GitHubRepository`
- **Fields Collected**:
  - **Google Search Console**: OAuth access token, refresh token, expiry timestamp, site URL.
    - *Storage*: OAuth tokens are encrypted at rest using AES-256-GCM via `SecurityService`.
    - *Telemetry*: Query text, impressions, clicks, CTR, average position.
  - **GitHub**: Repository owner, repo name, encrypted access token/installation token, default branch.
    - *Storage*: Access tokens are encrypted at rest using AES-256-GCM via `SecurityService`.

---

## 3. Storage Location & Encryption Matrix

| Data Class | Database / Engine | Encryption at Rest | Encryption in Transit | Retention Period |
| :--- | :--- | :--- | :--- | :--- |
| User Credentials & Sessions | PostgreSQL | DB volume encryption + hashed passwords | TLS 1.3 / HTTPS | Duration of account lifecycle |
| OAuth Tokens (Google / GitHub) | PostgreSQL (`GscIntegration`, `GitHubRepository`) | Application-level AES-256-GCM (`SecurityService`) | TLS 1.3 / HTTPS | Until integration disconnect or account deletion |
| Scraped Page Data & Telemetry | PostgreSQL (`Page`, `CrawlJob`) | DB volume encryption | TLS 1.3 / HTTPS | Until job purge or project deletion |
| Job Queues & Rate Limits | Redis (BullMQ) | Memory / Redis persistence encryption | TLS optional in local; TLS required in cloud | Transient (TTL-governed; 24-72h for job records) |
| AI Prompt Exchanges | Third-Party AI APIs (OpenAI, Anthropic, Gemini, Mammouth) | Provider-managed TLS | TLS 1.3 / HTTPS | Zero retention / no training confirmed per enterprise API agreements |

---

## 4. Business Owner Inputs Required
- [ ] `TODO: BUSINESS OWNER INPUT REQUIRED`: Confirm formal Data Protection Officer (DPO) contact email.
- [ ] `TODO: BUSINESS OWNER INPUT REQUIRED`: Formal registration jurisdiction and company legal entity name.
