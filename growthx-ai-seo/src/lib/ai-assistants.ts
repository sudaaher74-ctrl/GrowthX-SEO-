/** Display names for the AI assistants AI Visibility can measure. */
const ASSISTANT_LABELS: Record<string, string> = {
  SARVAM: "Sarvam",
  CHATGPT: "ChatGPT",
  OPENAI: "ChatGPT",
  GPT: "ChatGPT",
  CLAUDE: "Claude",
  ANTHROPIC: "Claude",
  GEMINI: "Gemini",
  GOOGLE: "Gemini",
  PERPLEXITY: "Perplexity",
  GROK: "Grok",
  OPENROUTER: "ChatGPT (gpt-4o-mini)",
  AI_OVERVIEWS: "AI Overviews",
  COPILOT: "Copilot",
};

function inferFamilyFromModel(model: string): string | null {
  const lower = model.toLowerCase();
  if (lower.includes("gpt") || lower.includes("openai") || /\bo[134]\b/.test(lower)) return "ChatGPT";
  if (lower.includes("claude") || lower.includes("anthropic")) return "Claude";
  if (lower.includes("gemini") || lower.includes("google")) return "Gemini";
  if (lower.includes("perplexity") || lower.includes("sonar")) return "Perplexity";
  if (lower.includes("grok") || lower.includes("x-ai")) return "Grok";
  if (lower.includes("sarvam")) return "Sarvam";
  if (lower.includes("llama") || lower.includes("meta-llama")) return "Llama";
  if (lower.includes("deepseek")) return "DeepSeek";
  if (lower.includes("mistral")) return "Mistral";
  if (lower.includes("qwen")) return "Qwen";
  return null;
}

export function assistantLabel(assistant: string, model?: string | null): string {
  const cleanModel = model?.trim() || "";
  const shortModel = cleanModel.includes("/") ? cleanModel.split("/").pop()!.trim() : cleanModel;
  const upperAssistant = (assistant || "").trim().toUpperCase();

  const familyFromModel = cleanModel ? inferFamilyFromModel(cleanModel) : inferFamilyFromModel(assistant || "");
  const baseFamily =
    familyFromModel ||
    (upperAssistant !== "OPENROUTER" ? ASSISTANT_LABELS[upperAssistant] : null) ||
    (shortModel ? shortModel : ASSISTANT_LABELS[upperAssistant] ?? assistant);

  if (shortModel && shortModel.toLowerCase() !== "unknown" && shortModel.toLowerCase() !== baseFamily.toLowerCase()) {
    return `${baseFamily} (${shortModel})`;
  }

  return baseFamily;
}

/**
 * "Sarvam", "Sarvam and ChatGPT", "Sarvam, ChatGPT and Claude" — for copy that
 * names what was actually asked. With none known it reads "AI assistants",
 * which fits every sentence this is used in; "no AI assistant" did not
 * ("earn citations from no AI assistant").
 */
export function assistantList(assistants: string[] | undefined): string {
  const names = Array.from(new Set((assistants ?? []).map((a) => assistantLabel(a))));
  if (names.length === 0) return "AI assistants";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
