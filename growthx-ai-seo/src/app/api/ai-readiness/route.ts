import { NextRequest, NextResponse } from "next/server";

interface AiBotRuleResult {
  bot: string;
  vendor: string;
  purpose: string;
  status: "ALLOWED" | "BLOCKED" | "UNSPECIFIED";
  matchedRule: string | null;
}

const AI_BOTS: Array<{ bot: string; vendor: string; purpose: string }> = [
  { bot: "OAI-SearchBot", vendor: "OpenAI", purpose: "ChatGPT Search indexing & citations" },
  { bot: "ChatGPT-User", vendor: "OpenAI", purpose: "Live ChatGPT user browsing" },
  { bot: "GPTBot", vendor: "OpenAI", purpose: "OpenAI model training crawler" },
  { bot: "PerplexityBot", vendor: "Perplexity", purpose: "Perplexity AI search & answers" },
  { bot: "ClaudeBot", vendor: "Anthropic", purpose: "Claude search & web retrieval" },
  { bot: "Google-Extended", vendor: "Google", purpose: "Gemini & Google AI grounding" },
  { bot: "CCBot", vendor: "Common Crawl", purpose: "Open web AI dataset" },
];

const PUBLIC_HOSTNAME_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function isSafePublicDomain(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  if (!cleaned || cleaned.length > 253) return null;
  if (!PUBLIC_HOSTNAME_RE.test(cleaned)) return null;
  if (
    cleaned === "localhost" ||
    cleaned.endsWith(".local") ||
    cleaned.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(cleaned)
  ) {
    return null;
  }
  return cleaned;
}

function parseAiBotsFromRobotsTxt(robotsTxt: string | null): AiBotRuleResult[] {
  if (!robotsTxt || !robotsTxt.trim()) {
    return AI_BOTS.map((b) => ({ ...b, status: "UNSPECIFIED", matchedRule: null }));
  }

  const groups: Array<{ agents: string[]; rules: Array<{ type: "allow" | "disallow"; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ type: "allow" | "disallow"; path: string }> } | null = null;
  let seenRuleInCurrent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (!current || seenRuleInCurrent) {
        current = { agents: [], rules: [] };
        groups.push(current);
        seenRuleInCurrent = false;
      }
      if (val) current.agents.push(val.toLowerCase());
    } else if ((key === "disallow" || key === "allow") && current) {
      seenRuleInCurrent = true;
      current.rules.push({ type: key, path: val });
    }
  }

  const evalRoot = (rules: Array<{ type: "allow" | "disallow"; path: string }>): { status: "ALLOWED" | "BLOCKED"; rule: string } | null => {
    let best: { type: "allow" | "disallow"; path: string } | null = null;
    for (const r of rules) {
      if (r.type === "disallow" && r.path === "") {
        if (!best) best = { type: "allow", path: "/" };
        continue;
      }
      if (r.path === "/" || r.path === "/*") {
        if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.type === "allow")) {
          best = r;
        }
      }
    }
    if (!best) return null;
    return {
      status: best.type === "disallow" ? "BLOCKED" : "ALLOWED",
      rule: `${best.type === "disallow" ? "Disallow" : "Allow"}: ${best.path}`,
    };
  };

  const wildcardRules = groups.filter((g) => g.agents.includes("*")).flatMap((g) => g.rules);
  const wildcardVerdict = evalRoot(wildcardRules);

  return AI_BOTS.map((b) => {
    const specificRules = groups.filter((g) => g.agents.includes(b.bot.toLowerCase())).flatMap((g) => g.rules);
    const specificVerdict = evalRoot(specificRules);
    if (specificVerdict) {
      return { ...b, status: specificVerdict.status, matchedRule: `User-agent: ${b.bot} → ${specificVerdict.rule}` };
    }
    if (wildcardVerdict) {
      return { ...b, status: wildcardVerdict.status, matchedRule: `User-agent: * → ${wildcardVerdict.rule}` };
    }
    return { ...b, status: "ALLOWED", matchedRule: "No blocking rule in robots.txt" };
  });
}

export async function GET(req: NextRequest) {
  const domain = isSafePublicDomain(req.nextUrl.searchParams.get("domain") || "");
  if (!domain) {
    return NextResponse.json({ error: "A valid public domain is required." }, { status: 400 });
  }

  const origin = `https://${domain}`;
  const [robotsResult, llmsResult] = await Promise.all([
    fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": "Reigel-AI-SEO-Audit/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then(async (r) => ({ status: r.status, text: r.ok ? await r.text() : null }))
      .catch(() => ({ status: 0, text: null })),
    fetch(`${origin}/llms.txt`, {
      headers: { "User-Agent": "Reigel-AI-SEO-Audit/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then(async (r) => ({
        exists: r.ok,
        status: r.status,
        preview: r.ok ? (await r.text()).slice(0, 1200) : null,
      }))
      .catch(() => ({ exists: false, status: 0, preview: null })),
  ]);

  return NextResponse.json(
    {
      domain,
      robotsTxtFound: robotsResult.status === 200,
      aiBots: parseAiBotsFromRobotsTxt(robotsResult.text),
      llmsTxt: llmsResult,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
