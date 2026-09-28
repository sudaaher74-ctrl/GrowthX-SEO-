"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, FilePlus2, PenLine, Search, Sparkles } from "lucide-react";
import { ActionButton, Panel, Pill } from "@/components/ui/console";
import { CreateArticleModal } from "@/components/content/create-article-modal";
import { AlmostWinningPanel, MeasuredBadge, SearchConnectNote } from "@/components/content/search-numbers";
import type { ContentIdeas } from "@/lib/api-client";
import { keywordsText } from "@/lib/content-ideas";

/**
 * "Words your customers search for" and "Blog posts to write", the part of a
 * report that says what to do next rather than what is wrong.
 *
 * Suggested by Sarvam from the business's own pages (and, in the competitor
 * report, what the rivals cover). Where a phrase is one of the searches the
 * site already appears in, it carries Google's own numbers from Search
 * Console; every other phrase is labelled a suggestion. The searches the
 * site almost wins are listed first, with their numbers. Each post can be
 * handed straight to the article writer with its title and phrase filled in.
 */
export function ContentIdeasPanels({
  projectId,
  ideas,
  error,
}: {
  projectId: string;
  /** Undefined on a report written before suggestions existed. */
  ideas: ContentIdeas | null | undefined;
  error?: string | null;
}) {
  const [writing, setWriting] = useState<ContentIdeas["blogIdeas"][number] | null>(null);
  const [drafted, setDrafted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (ideas === undefined) {
    return (
      <Panel title="Keywords and blog ideas" padded>
        <p className="text-[12.5px] text-brand-600">
          Create a new report to get the words your customers search for and blog posts to write, suggested by Sarvam
          105B from your website.
        </p>
      </Panel>
    );
  }
  if (!ideas || (!ideas.keywords.length && !ideas.blogIdeas.length)) {
    return (
      <Panel title="Keywords and blog ideas" padded>
        <p className="text-[12.5px] text-brand-600">{error ?? "No suggestions this time. Create the report again to retry."}</p>
      </Panel>
    );
  }

  const by = ideas.model ?? "Sarvam";
  const search = ideas.search;
  const measuredOn = search?.status === "OK";
  const anyMeasured = ideas.keywords.some((k) => k.measured);
  const copyKeywords = async () => {
    try {
      await navigator.clipboard.writeText(keywordsText(ideas));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the phrases are on screen to select by hand.
    }
  };

  return (
    <>
      <SearchConnectNote status={search?.status} />

      {measuredOn && search && <AlmostWinningPanel searches={search.almostWinning} days={search.days} />}

      {ideas.keywords.length > 0 && (
        <Panel
          title="Words your customers search for"
          subtitle={
            anyMeasured
              ? `Use these phrases in your page titles, headings and text. Green numbers are Google's own, from your Search Console${search ? ` (last ${search.days} days)` : ""}; the rest are suggestions by ${by} from your pages.`
              : `Use these phrases in your page titles, headings and text, so Google shows you when people search for them. Suggested by ${by} from your own pages. These are ideas, not measured search numbers.`
          }
          actions={
            <ActionButton icon={copied ? <Check size={12} className="text-success-600" /> : <Copy size={12} />} onClick={copyKeywords}>
              {copied ? "Copied" : "Copy all"}
            </ActionButton>
          }
        >
          <ul className="divide-y">
            {ideas.keywords.map((k) => (
              <li key={k.phrase} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-brand-950 sm:w-64">
                  <Search size={13} className="shrink-0 text-primary-600" />
                  {k.phrase}
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] text-brand-600">
                  {k.why}
                  {measuredOn && (
                    <span className="mt-1 block">
                      <MeasuredBadge measured={k.measured} days={search?.days} />
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11.5px]">
                  {k.usePage ? (
                    <span className="text-brand-500">
                      Use on <span className="font-medium text-brand-800">{k.usePage}</span>
                    </span>
                  ) : (
                    <Pill tone="info">Needs a new page</Pill>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {ideas.blogIdeas.length > 0 && (
        <Panel
          title="Blog posts to write"
          subtitle={`Each one answers something your customers want to know, and helps you get found for one of the phrases above. Suggested by ${by}.`}
        >
          {drafted && (
            <p className="flex items-center gap-1.5 border-b bg-success-50 px-4 py-2.5 text-[12px] text-success-700">
              <Check size={13} /> &ldquo;{drafted}&rdquo; is ready.{" "}
              <Link href="/content-ai" className="font-semibold underline">
                Open it in Content
              </Link>
            </p>
          )}
          <ul className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            {ideas.blogIdeas.map((b) => (
              <li key={b.title} className="flex flex-col gap-2 rounded-lg border bg-brand-50 p-3.5">
                <p className="flex items-start gap-1.5 text-[13.5px] font-semibold leading-snug text-brand-950">
                  <FilePlus2 size={14} className="mt-0.5 shrink-0 text-primary-600" />
                  {b.title}
                </p>
                {b.covers && <p className="text-[12.5px] leading-relaxed text-brand-600">{b.covers}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  {b.keyword ? <Pill tone="default">For: {b.keyword}</Pill> : <span />}
                  <ActionButton variant="primary" icon={<PenLine size={12} />} onClick={() => setWriting(b)}>
                    Write this post
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1.5 border-t px-4 py-2.5 text-[11px] text-brand-400">
            <Sparkles size={11} /> &ldquo;Write this post&rdquo; opens the article writer with the title and phrase filled in. The
            draft is saved in Content for you to check and edit.
          </p>
        </Panel>
      )}

      {writing && (
        <CreateArticleModal
          projectId={projectId}
          initialTitle={writing.title}
          initialTargetQuery={writing.keyword}
          initialRationale={writing.covers}
          onClose={() => setWriting(null)}
          onSuccess={(piece) => setDrafted(piece.title ?? writing.title)}
        />
      )}
    </>
  );
}
