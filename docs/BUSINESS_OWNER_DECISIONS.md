# Business Owner Decisions & Configuration Checklist

> **Note for the Business Owner / Founder**:
> All technical security, privacy, and compliance infrastructure has been implemented in code.
> To complete legal, compliance, and production readiness, please review and provide the required business details below.
> **No business facts have been fabricated.**

---

## 1. Company Identity & Legal Structure

Please specify the official legal information to replace template placeholders in `/legal/privacy`, `/legal/terms`, and `/legal/security`:

- [ ] **Full Legal Entity Name**: `TODO: BUSINESS OWNER INPUT REQUIRED` (e.g., *Reigel Technologies Inc.* or *GrowthX LLC*)
- [ ] **Corporate Registration Jurisdiction**: `TODO: BUSINESS OWNER INPUT REQUIRED` (e.g., *Delaware, United States* / *United Kingdom*)
- [ ] **Registered Office / Physical Address**: `TODO: BUSINESS OWNER INPUT REQUIRED`
- [ ] **Official Contact Email**: `TODO: BUSINESS OWNER INPUT REQUIRED` (e.g., `legal@reigel.ai` or `support@reigel.ai`)
- [ ] **Designated Privacy / DPO Email**: `TODO: BUSINESS OWNER INPUT REQUIRED` (e.g., `privacy@reigel.ai`)
- [ ] **Security Disclosure Email**: `TODO: BUSINESS OWNER INPUT REQUIRED` (e.g., `security@reigel.ai`)

---

## 2. Infrastructure & Sub-processor Acknowledgement

Confirm the production hosting vendors and third-party vendors used to update the public Sub-processor disclosure table:

| Sub-processor | Purpose | Status in Code | Owner Confirmation Required |
| :--- | :--- | :--- | :--- |
| **Hosting & Cloud** | Application & API Hosting | Vercel / AWS / Render / GCP | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **Database** | Managed PostgreSQL | PostgreSQL / Neon / Supabase | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **Cache & Queues** | BullMQ & Redis | Redis / Upstash | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **Anthropic PBC** | LLM Processing (Claude) | Configured in Multi-AI Router | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **OpenAI Inc.** | LLM Processing (GPT-4o) | Configured in Multi-AI Router | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **Google Cloud** | Gemini API & Search Console | Configured in Multi-AI Router & GSC | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **Perplexity AI** | Search Citations | Configured in Multi-AI Router | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **Mammouth AI** | SEO AI Models | Configured in Multi-AI Router | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |
| **Sarvam AI** | Regional Languages | Configured in Multi-AI Router | [ ] `TODO: BUSINESS OWNER INPUT REQUIRED` |

---

## 3. Policy & Feature Decisions

- [ ] **Analytics & Tracking**:
  - Reigel currently uses zero third-party marketing trackers (only strictly necessary session and CSRF cookies).
  - *Decision*: Will marketing cookies (Meta Pixel, Google Tag Manager) be added later? If yes, a cookie banner with prior consent must be activated.
- [ ] **Fix Engine Execution Mode in Production**:
  - `AUTONOMOUS_ENGINEER_RUN_BUILDS` is currently set to `false` (safely verifying syntax via AST and opening Pull Requests without executing untrusted customer `npm install` on the API server).
  - *Decision*: Keep `AUTONOMOUS_ENGINEER_RUN_BUILDS=false` for API servers, or deploy an isolated ephemeral worker sandbox (e.g. AWS Fargate, Fly Machines) if full remote build verification is desired.
- [ ] **Data Retention Window for Crawl Telemetry**:
  - Recommended: Retain historical crawl telemetry for 90 days or until project deletion.
  - *Decision*: Confirm desired maximum retention window for historical crawl data.
