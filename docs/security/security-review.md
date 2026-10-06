# Production Security Review & Hardening Audit

## 1. Executive Summary
This document provides a comprehensive security review of the Reigel / GrowthX application architecture, detailing hardening measures implemented across web authentication, session management, cross-origin security, API boundaries, and real-time WebSockets.

---

## 2. Security Controls & Implementations

### 2.1 Transport & Network Security
- **Strict HTTPS / TLS 1.3**: All public traffic is routed over TLS.
- **Security Headers (Helmet & Next.js Config)**:
  - `X-Frame-Options: DENY` (prevents clickjacking attacks).
  - `X-Content-Type-Options: nosniff` (mitigates MIME-confusion attacks).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (enforced in production).

### 2.2 Browser Authentication & Cookie Security
- **HttpOnly Session Cookies**:
  - `auth_token`: Short-lived (15-minute) JWT access token stored in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie. Inaccessible to client-side JavaScript, eliminating XSS token exfiltration risks.
  - `refresh_token`: 30-day token restricted strictly to `Path=/auth`. Inaccessible on standard application API endpoints.
- **CSRF Defense (Double-Submit + Origin Verification)**:
  - Verified by `CsrfGuard` across all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Verifies incoming `Origin` / `Referer` headers against an explicit domain allowlist (`ALLOWED_ORIGINS`).
  - Verifies that the client-supplied `X-CSRF-Token` header matches the signed `csrf_token` cookie.
- **Backward Compatibility for API Automation**:
  - Non-browser clients sending standard `Authorization: Bearer <token>` headers remain supported while browser clients use `X-Auth-Mode: cookie`.

### 2.3 WebSocket Hardening (`CrawlerGateway`)
- **Handshake Authentication**:
  - WebSockets reject anonymous connections. The handshake parses and validates the `auth_token` cookie or bearer authorization token.
- **Room-Level Subscription Scoping**:
  - `subscribe.crawl`: Enforces project and organization verification. A client can only subscribe to rooms matching crawl jobs belonging to their authorized tenant workspace (`crawl:<jobId>`).
  - `subscribe.aiva`: Verifies user ownership before joining real-time voice intelligence sessions (`aiva:<sessionId>`).
  - Global, unauthenticated broadcast channels have been eliminated.

### 2.4 SQL & Database Protection
- **Prisma Parameterized Queries**: All database queries utilize Prisma ORM with parameterized arguments, preventing SQL injection vulnerabilities.
- **Application-Level Multi-Tenancy**: Organization IDs and Project IDs are enforced as filter constraints on every data access query.

### 2.5 Secret Protection & Encryption at Rest
- Sensitive external tokens (Google OAuth refresh tokens, GitHub PATs) are encrypted at rest using **AES-256-GCM** with unique initialization vectors (`SecurityService`).
- Plaintext secrets are stripped from responses and logging streams.

### 2.6 AI Safety & Boundary Defense
- Centralized sanitization pipeline (`MultiAiRouterService`) redacting database strings, Redis URLs, JWTs, and API keys before external prompt submission (`redactSecretsForAi`).
- Unverified crawled content is wrapped in `<UNTRUSTED_CONTENT_*>` delimiters to prevent indirect prompt injection.
