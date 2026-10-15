<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployment source of truth

Make application fixes and server configuration changes in this Git repository first. Test the change, commit it, and deploy the resulting commit or image on every host that needs it. Never leave a fix only in a running container, generated `dist` file, derived hotfix image, or host checkout. Keep deployment commands and any required non-secret settings in the repository.

Keep API keys, database passwords, encryption keys, OAuth secrets, and tunnel credentials outside Git. When replacing a host, restore the database and those secrets to the new host and point the stable API hostname to it. Follow [docs/operations/move-server.md](docs/operations/move-server.md).

## Active AI cost policy

Follow [the owner's low-cost AI policy](docs/operations/low-cost-ai-policy.md).
Use direct Gemini Flash-Lite for routine analysis and Gemini Flash for competitor
investigation and moderate code generation. Other approved visibility models use
OpenRouter: GPT-4.1 Mini, Claude Haiku 4.5, Perplexity Sonar, and Grok 4 Fast.
Do not substitute another model when an approved identity is unavailable.
Premium models, paid research-search tools and automatic model upgrades are
disabled. New AI features must use the shared router and spending reservations;
do not add an SDK path that bypasses them. Do not disable `AI_LOW_COST_POLICY`
outside legacy tests without a new explicit owner instruction. Platform cap:
INR 1,000 monthly. INR 100/customer is an initial target, not a guaranteed cost.
Keep visibility, internal analysis and code budgets separate, and never serve a
new visibility measurement from an internal-analysis cache.
