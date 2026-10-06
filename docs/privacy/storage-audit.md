# Storage & Database Privacy Audit

## 1. Schema Analysis & Data Retention Footprint

The application persists state using PostgreSQL managed by Prisma ORM. This audit details tables containing sensitive user, organization, or customer data, alongside encryption and cascade behaviors.

---

## 2. Table-by-Table Privacy & Retention Audit

### 2.1 User & Identity Tables
- **`User`**:
  - Contains: `id`, `email`, `passwordHash`, `name`, `avatarUrl`, `role`, `createdAt`, `updatedAt`.
  - Retention: Retained until explicit user deletion or organizational purge.
  - Cascades:
    - Direct relation to `OrganizationMember`: Cascaded upon deletion.
    - Relation to `RefreshSession`: Cascaded upon deletion.
    - Relation to `LoginCode`: Cascaded upon deletion.
    - Relation to `AuditLog`: **No cascade constraint**; `AuditLog.userId` is explicitly set to `null` prior to User deletion in `UsersService.deleteAccount()` to preserve audit history integrity without retaining PII.
- **`RefreshSession`**:
  - Contains: `id`, `tokenHash`, `userId`, `ipAddress`, `userAgent`, `expiresAt`, `revokedAt`.
  - Retention: Revoked on logout or session termination; records purged on account deletion.
- **`LoginCode`**:
  - Contains: `id`, `email`, `codeHash`, `expiresAt`, `usedAt`.
  - Retention: Single-use with short TTL (15 minutes).

### 2.2 Workspace & Multi-Tenancy Tables
- **`Organization`**:
  - Contains: `id`, `name`, `slug`, `billingTier`, `tokenBalance`.
  - Ownership: Handled via `OrganizationMember`.
- **`OrganizationMember`**:
  - Contains: `id`, `organizationId`, `userId`, `role`.
  - Enforces workspace data isolation.

### 2.3 Project & Crawl Tables
- **`Project`**:
  - Contains: `id`, `name`, `domain`, `organizationId`, `createdAt`.
  - Cascades: Cascades deletion to `CrawlJob`, `GscIntegration`, `GitHubRepository`, and linked project entities.
- **`Website`**:
  - Primary websites have `projectId` set.
  - Competitor websites use `projectId = null` and store tracking scopes such as `competitor:<projectId>`.
  - Cleaned explicitly in `ProjectsService.deleteProject()` to avoid orphan records.
- **`CrawlJob`**:
  - Contains: `id`, `projectId`, `status`, `targetUrl`, `pagesCrawled`, `limits`, `createdAt`.
  - State machine: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`.
  - In-flight jobs are cancelled gracefully on project deletion.
- **`Page`**:
  - Contains: `id`, `jobId`, `url`, `status`, `title`, `metaDescription`, `h1`, `wordCount`, `performanceScore`.
  - Scoped to `CrawlJob` and cascades automatically when the job or project is removed.
- **`TechnicalIssue`**:
  - Contains: Issue type, severity, evidence, recommendations. Cascades with `Page` / `CrawlJob`.

### 2.4 Integration Secrets Tables
- **`GscIntegration`**:
  - Fields: `accessTokenEncrypted`, `refreshTokenEncrypted`, `tokenExpiresAt`, `siteUrl`.
  - Encryption: Encrypted at application layer using AES-256-GCM via `SecurityService`.
  - Revocation: When a project or account is deleted, the refresh token is revoked at Google's OAuth endpoints (`https://oauth2.googleapis.com/revoke`) prior to database record deletion.
- **`GitHubRepository`**:
  - Fields: `owner`, `name`, `accessTokenEncrypted`, `defaultBranch`.
  - Encryption: Encrypted at application layer using AES-256-GCM via `SecurityService`.
  - Token scrubbing: Plaintext tokens are scrubbed from memory and never returned via API responses.

---

## 3. Ephemeral Storage (Redis & Disk)
- **Redis (BullMQ)**:
  - Stores temporary crawl jobs, queue status, rate limiting locks, and socket subscription state.
  - TTL-governed; expired completed/failed jobs expire after retention window.
- **Local Temporary Files**:
  - Autonomous engineer syntax and build validation creates isolated temp folders in OS temp dir (`growthx-build-*`).
  - Temp directories are removed unconditionally in a `finally` block via `fs.rm(home, { recursive: true, force: true })`.
