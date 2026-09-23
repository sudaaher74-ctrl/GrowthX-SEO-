# AI Visibility (AEO / GEO)

Measures whether AI assistants recommend the customer when answering the questions
their buyers actually ask. This is the ₹5,000 Pro tier's differentiator — the whole
surface sits behind `Feature.AI_VISIBILITY`.

## What this can and cannot measure

| Assistant | Measurable | Why |
|---|---|---|
| ChatGPT | ✅ | OpenAI API |
| Claude | ✅ | Anthropic API |
| Gemini | ✅ | Google GenAI API |
| Sarvam (Indus) | ✅ | Sarvam API (`SARVAM_API_KEY`, `sarvam-105b`) |
| Perplexity | ❌ | No adapter yet — has an API, not wired |
| Google AI Overviews | ❌ | No public API |
| Copilot | ❌ | No public API |

The unmeasurable three are in the `AiAssistant` enum so the dashboard can show them,
but a check against one writes a `PromptCheck` with `error` set. **They never appear
as a 0% score**, because "we could not ask" is a different fact from "you were not
recommended", and conflating them would understate a customer's real position.

Adding Perplexity later means one entry in `ASSISTANT_PROVIDER` and a provider in the
router — nothing else changes.

Each assistant is answered only by its own vendor. A deployment that has only a
Sarvam key measures Sarvam and lists ChatGPT, Claude and Gemini under
`skippedAssistants` — it never asks Sarvam and files the answer as "ChatGPT". The
dashboard's `measurableAssistants` lists what this deployment can actually ask.

> **Framing for sales:** this measures and tracks citation share. It does not
> guarantee placement. Nobody can promise a ranking inside someone else's model.

## How a check works

1. The tracked prompt is asked as a **plain end-user question** — no instruction to
   mention any brand, because a primed answer would not reflect what a real user sees.
2. `detectCitation()` scans the answer for the customer's domains and brand names, and
   for each tracked competitor.
3. Position is the customer's rank **by first mention** among all brands named.
4. The answer is stored (2,000 chars) as evidence the customer can inspect.

## Competitor labels matter

`detectCitation` derives a brand name from the domain label — `summitgrove.com` →
`summitgrove`. It cannot derive `Summit Grove`, so an answer that names the brand
with a space is missed unless `CompetitorDomain.label` is set. Set the label whenever
the brand isn't a single word; this is the single biggest source of undercounted
share-of-voice.

## Billing

`sweepProject` verifies `AI_VISIBILITY_CHECKS` for the whole batch **before** running
anything, then records usage only for checks that succeeded — a provider outage costs
the customer nothing. Pro includes 3,000 checks/month; with 3 assistants that is
~33 prompts checked daily (fewer when more assistants are configured).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects/:projectId/ai-visibility` | Citation share, per-assistant, share of voice, weekly trend |
| `GET` | `/api/projects/:projectId/ai-visibility/prompts` | Tracked prompts + latest result per assistant |
| `POST` | `/api/projects/:projectId/ai-visibility/prompts` | Add/update tracked prompts |
| `POST` | `/api/projects/:projectId/ai-visibility/competitors` | Track a rival (set `label`!) |
| `POST` | `/api/projects/:projectId/ai-visibility/sweep` | Run all checks now |
| `GET` | `/api/projects/:projectId/ai-visibility/aeo` | On-page answer-engine readiness |
| `GET`/`POST` | `/api/projects/:projectId/ai-visibility/insights` | AI-written analysis + recommendations from measured checks (`question` to ask something specific) |
| `POST` | `/api/projects/:projectId/ai-visibility/simulate` | Ask one query live to each enabled engine, plus a drafted answer section |

A daily sweep runs at 06:00 UTC (`AI_VISIBILITY_SWEEP_ENABLED=false` to disable). It
skips orgs whose plan lapsed or whose allowance is spent, and one failing project
never aborts the run for the rest.
