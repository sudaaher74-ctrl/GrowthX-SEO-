"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ActionButton } from "@/components/ui/console";

const plugins = [remarkGfm];

/** Render saved assistant text without rewriting it or executing embedded HTML. */
export function FormattedAnswer({ text }: { text: string }) {
  return (
    <div className="min-w-0 space-y-4 break-words text-sm leading-7 text-brand-700 [&_a]:break-words [&_a]:font-medium [&_a]:text-primary-700 [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold [&_strong]:text-brand-950 [&_h4]:mt-6 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-6 [&_h4]:text-brand-950 [&_h5]:mt-5 [&_h5]:font-semibold [&_h5]:text-brand-950 [&_h6]:mt-4 [&_h6]:font-semibold [&_h6]:text-brand-950 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_li>ul]:mt-2 [&_li>ol]:mt-2 [&_li>p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-brand-600 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-brand-50 [&_pre]:p-4 [&_code]:font-mono [&_code]:text-xs [&_hr]:my-6 [&_input]:mr-2">
      <Markdown
        remarkPlugins={plugins}
        skipHtml
        components={{
          h1: ({ children }) => <h4 className="!text-lg">{children}</h4>,
          h2: ({ children }) => <h4>{children}</h4>,
          h3: ({ children }) => <h5>{children}</h5>,
          h4: ({ children }) => <h6>{children}</h6>,
          h5: ({ children }) => <h6>{children}</h6>,
          h6: ({ children }) => <h6>{children}</h6>,
          a: ({ href, children }) => {
            // Links in assistant output must never execute script/data URLs.
            if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>;
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          img: ({ alt }) => <span>{alt}</span>,
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto rounded-lg border" role="region" aria-label="Answer table" tabIndex={0}>
              <table className="w-full min-w-96 border-collapse text-left text-sm [&_th]:border-b [&_th]:bg-brand-50 [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-brand-950 [&_td]:border-b [&_td]:px-4 [&_td]:py-3 [&_tr:last-child_td]:border-b-0">{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export function AnswerDocument({ text, assistant }: { text: string; assistant: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <div className="mt-4 min-w-0 border-t pt-4">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brand-950">Answer from {assistant}</p>
          <p className="mt-1 text-xs text-brand-500">Original wording · Formatted for readability</p>
        </div>
        <ActionButton variant="secondary" onClick={copyAnswer}>Copy answer</ActionButton>
        <span role="status" className="text-xs text-brand-600">
          {copyState === "copied" ? "Answer copied" : copyState === "failed" ? "Copy unavailable. Select the answer text to copy it." : ""}
        </span>
      </div>
      <FormattedAnswer text={text} />
    </div>
  );
}
