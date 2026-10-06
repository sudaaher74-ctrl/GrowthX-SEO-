# GitHub Integration & Autonomous Fix Policy

## 1. Overview
Reigel offers an optional GitHub repository integration designed to automate technical SEO remediation (e.g., adding missing meta tags, JSON-LD structured schema, and alt attributes) by preparing transparent Pull Requests for developer review.

---

## 2. Authentication & Access Tokens
- Customers connect GitHub repositories using a Personal Access Token (PAT) or GitHub App Installation Token.
- **Scope Requirements**:
  - `repo` (or fine-grained repository permissions: `Read & Write` access to code, pull requests, and metadata for specific repositories).
- **Security & Storage**:
  - Tokens are validated upon entry (`git.verifyAccess`) and immediately encrypted using **AES-256-GCM** via `SecurityService`.
  - Plaintext tokens are scrubbed from system memory and excluded from all API responses and database logs.

---

## 3. Pull Request Safety Framework

To protect customer codebases against unintended changes:

1. **Pull Requests Only, Never Direct Push**:
   - Reigel never pushes directly to `main`, `master`, or production branches.
   - All proposed fixes are committed to dedicated feature branches (`growthx/seo-fix-*`) and submitted as standard Pull Requests.
2. **Whitelist of Automated Fix Types**:
   - The autonomous engine only prepares changes where errors are low-risk and easily reviewable in a git diff:
     - `META_TITLE`
     - `META_DESCRIPTION`
     - `METADATA`
     - `ALT_TEXT`
     - `BREADCRUMB_SCHEMA`
     - `FAQ_SCHEMA`
     - `ORGANIZATION_SCHEMA`
     - `PRODUCT_SCHEMA`
   - High-risk architectural fixes (such as canonical URL changes, heading restructuring, and internal linking) are **never automated** and require manual human intervention.
3. **AST Syntax Validation (No Untrusted Code Execution)**:
   - Modified files are verified using the TypeScript compiler AST transpile diagnostics (`ts.transpileModule`) in memory to ensure zero syntax or JSX parsing errors.
   - Arbitrary customer build scripts and `npm install` execution are disabled by default on the API host (`AUTONOMOUS_ENGINEER_RUN_BUILDS=false`).

---

## 4. Integration Disconnection
When a customer disconnects GitHub or deletes the project:
1. The encrypted access token record is permanently removed from the database.
2. Local cloned temporary git working directories are wiped immediately (`fs.rm(..., { recursive: true, force: true })`).
