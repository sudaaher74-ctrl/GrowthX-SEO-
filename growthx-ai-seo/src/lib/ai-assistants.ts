/** Display names for the AI assistants AI Visibility can measure. */
const ASSISTANT_LABELS: Record<string, string> = {
  SARVAM: "Sarvam",
  CHATGPT: "ChatGPT",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
  PERPLEXITY: "Perplexity",
  AI_OVERVIEWS: "AI Overviews",
  COPILOT: "Copilot",
};

export function assistantLabel(assistant: string): string {
  return ASSISTANT_LABELS[assistant] ?? assistant;
}

/**
 * "Sarvam", "Sarvam and ChatGPT", "Sarvam, ChatGPT and Claude" — for copy that
 * names what was actually asked. With none known it reads "AI assistants",
 * which fits every sentence this is used in; "no AI assistant" did not
 * ("earn citations from no AI assistant").
 */
export function assistantList(assistants: string[] | undefined): string {
  const names = (assistants ?? []).map(assistantLabel);
  if (names.length === 0) return "AI assistants";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
