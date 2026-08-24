"use client";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useWorkspace, useAskAi } from "@/hooks/use-growthx";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, Send, Sparkles, User, RefreshCw, Copy, ThumbsUp, ThumbsDown } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const suggestedPrompts = [
  "Why did traffic drop last week?",
  "What are my best keyword opportunities?",
  "Summarize my SEO health right now",
  "What should I fix first?",
];

function initialMessage(clientName?: string): Message {
  return {
    role: "assistant",
    content: clientName
      ? `Hi! I'm your AI SEO assistant for ${clientName}. I can see this client's dashboard, rankings, and technical issues in real time. Ask me anything — traffic drops, keyword opportunities, or what to fix next.`
      : "Hi! Select a client to give me access to their dashboard, rankings, and technical issues, then ask me anything.",
  };
}

export default function AIAssistantPage() {
  const { projectId, projects } = useWorkspace();
  const activeProject = projects.find((p) => p.id === projectId);

  return (
    <ChatPanel key={projectId ?? "none"} projectId={projectId} clientName={activeProject?.name} />
  );
}

function ChatPanel({ projectId, clientName }: { projectId: string | null; clientName?: string }) {
  const askAi = useAskAi(projectId);

  const [messages, setMessages] = useState<Message[]>([initialMessage(clientName)]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, askAi.isPending]);

  const sendMessage = async (text?: string) => {
    const content = text ?? input.trim();
    if (!content || askAi.isPending || !projectId) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);

    try {
      const result = await askAi.mutateAsync(content);
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
    } catch (err) {
      if (!(err instanceof ApiError && err.isUpgradeRequired)) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that — please try again." }]);
      }
    }
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

        {askAi.isPending && (
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
        {suggestedPrompts.map((prompt) => (
          <button key={prompt} onClick={() => sendMessage(prompt)} disabled={!projectId}
            className="text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-purple-400 hover:text-purple-500 transition-base bg-[var(--surface-1)] disabled:opacity-50 disabled:cursor-not-allowed">
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
            placeholder={projectId ? "Ask anything about your SEO — traffic drops, content ideas, technical fixes..." : "Select a client to start chatting..."}
            disabled={!projectId}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none leading-relaxed disabled:opacity-50"
            style={{ maxHeight: "120px" }}
          />
        </div>
        <Button variant="primary" onClick={() => sendMessage()} loading={askAi.isPending} disabled={!projectId} className="h-11 px-4">
          <Send size={15}/>
        </Button>
      </div>
    </div>
  );
}
