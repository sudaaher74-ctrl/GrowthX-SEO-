"use client";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { mockChatMessages, mockSuggestedPrompts } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, Send, Sparkles, User, RefreshCw, Copy, ThumbsUp, ThumbsDown } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; typing?: boolean };

const aiResponses: Record<string, string> = {
  default: "Based on your dashboard data, I can see that **milk delivery panvel** is your top performing keyword at position #2. Your overall SEO health score is 78/100. I'd recommend focusing on fixing the 4 critical technical issues first — particularly the canonical problems and 404 errors — as these are directly impacting your rankings. Would you like me to generate fixes for those?",
  traffic: "Analyzing your traffic patterns from the last 30 days... Your organic traffic grew 15.3% compared to the prior period. The biggest driver was the improvement of **milk delivery panvel** from position #4 to #2, which added approximately 680 additional clicks. I also notice a dip on July 19-21 — that coincided with a Google core update. Your site recovered well. No manual action detected.",
  keyword: "Here are your top keyword opportunities right now:\n\n1. **dairy subscription navi mumbai** — Volume: 1,400, Difficulty: 22, Opportunity Score: 95 ⭐\n2. **milk delivery kharghar** — Volume: 1,800, Difficulty: 18, Opportunity Score: 96 ⭐\n3. **organic milk delivery mumbai** — Volume: 3,200, Difficulty: 28, Opportunity Score: 90 ⭐\n\nAll three have low difficulty and high commercial intent — perfect for quick wins. Want me to generate optimized content for any of these?",
};

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>(mockChatMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = text ?? input.trim();
    if (!content || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content }]);
    setLoading(true);

    await new Promise(r => setTimeout(r, 1200));

    const lc = content.toLowerCase();
    let response = aiResponses.default;
    if (lc.includes("traffic") || lc.includes("drop")) response = aiResponses.traffic;
    if (lc.includes("keyword") || lc.includes("opportunit")) response = aiResponses.keyword;

    setMessages(prev => [...prev, { role: "assistant", content: response }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 3rem)" }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg-brand flex items-center justify-center">
            <Bot size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-h3 text-[var(--text-primary)]">AI SEO Assistant</h1>
            <p className="text-xs text-[var(--text-muted)]">Powered by GPT-4o · Has access to your full dashboard data</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>}>New Chat</Button>
      </motion.div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto card p-4 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            {/* Avatar */}
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold",
              msg.role === "assistant" ? "gradient-bg-brand" : "bg-purple-100 dark:bg-purple-900")}>
              {msg.role === "assistant" ? <Sparkles size={14}/> : <User size={14} className="text-purple-600 dark:text-purple-400"/>}
            </div>
            <div className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start", "max-w-[80%]")}>
              <div className={cn("px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line",
                msg.role === "user"
                  ? "gradient-bg-brand text-white rounded-tr-sm"
                  : "bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-sm"
              )}>
                {msg.content}
              </div>
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base"><ThumbsUp size={11}/></button>
                  <button className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base"><ThumbsDown size={11}/></button>
                  <button className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base"><Copy size={11}/></button>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full gradient-bg-brand flex items-center justify-center shrink-0"><Sparkles size={14} className="text-white"/></div>
            <div className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-2 mb-3 shrink-0">
        {mockSuggestedPrompts.slice(0, 4).map((prompt) => (
          <button key={prompt} onClick={() => sendMessage(prompt)}
            className="text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-purple-400 hover:text-purple-500 transition-base bg-[var(--surface-1)]">
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-3 shrink-0">
        <div className="flex-1 card flex items-end gap-2 px-4 py-3">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            placeholder="Ask anything about your SEO — traffic drops, content ideas, technical fixes..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none leading-relaxed"
            style={{ maxHeight: "120px" }}
          />
        </div>
        <Button variant="primary" onClick={() => sendMessage()} loading={loading} className="h-11 px-4">
          <Send size={15}/>
        </Button>
      </div>
    </div>
  );
}
