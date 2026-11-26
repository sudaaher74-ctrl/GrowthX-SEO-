"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, Loader2, MessageSquare, QrCode, Sparkles, Star } from "lucide-react";
import { ActionButton, Pill } from "@/components/ui/console";
import type { LocalCopilotPack, PlacesListingReview } from "@/lib/api-types";

export function ReviewQrKit({
  businessName,
  domain,
  reviewUrl,
  manageProfileUrl,
  reviews,
  copilot,
  onGenerateCopilot,
  generatingCopilot,
}: {
  businessName: string;
  domain: string | null;
  reviewUrl: string | null;
  manageProfileUrl: string;
  reviews: PlacesListingReview[];
  copilot: LocalCopilotPack | null;
  onGenerateCopilot: () => void;
  generatingCopilot: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewUrl) return;
    let active = true;
    QRCode.toDataURL(reviewUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [reviewUrl]);

  const effectiveQr = reviewUrl ? qrDataUrl : null;

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const defaultWhatsappScript = reviewUrl
    ? `Hi! Thanks for choosing ${businessName}. If you enjoyed your experience, could you spare 20 seconds for a quick Google review?\n${reviewUrl}`
    : `Connect your Google Maps listing to generate your 1-tap review link automatically.`;

  const whatsappMessage = copilot?.whatsappReviewRequest || defaultWhatsappScript;

  const handleDownloadPoster = async () => {
    if (!reviewUrl || !effectiveQr) return;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgb(226, 232, 240)";
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

    ctx.fillStyle = "rgb(15, 23, 42)";
    ctx.textAlign = "center";
    ctx.font = "bold 46px system-ui, -apple-system, sans-serif";
    ctx.fillText(businessName.slice(0, 34), canvas.width / 2, 150);

    ctx.fillStyle = "rgb(16, 185, 129)";
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
    ctx.fillText("★ ★ ★ ★ ★", canvas.width / 2, 215);

    ctx.fillStyle = "rgb(30, 41, 59)";
    ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
    ctx.fillText("Loved our service?", canvas.width / 2, 295);

    ctx.fillStyle = "rgb(71, 85, 105)";
    ctx.font = "26px system-ui, -apple-system, sans-serif";
    ctx.fillText("Scan to review us on Google", canvas.width / 2, 345);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("QR image failed"));
      img.src = effectiveQr;
    });
    const qrSize = 500;
    ctx.drawImage(img, (canvas.width - qrSize) / 2, 405, qrSize, qrSize);

    ctx.fillStyle = "rgb(15, 23, 42)";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("Mention what you bought and your area!", canvas.width / 2, 980);

    if (domain) {
      ctx.fillStyle = "rgb(100, 116, 139)";
      ctx.font = "22px monospace";
      ctx.fillText(domain, canvas.width / 2, 1055);
    }

    const link = document.createElement("a");
    link.download = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-review-qr-poster.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const replyMap = new Map((copilot?.reviewReplies ?? []).map((r) => [r.reviewName, r.suggestedReply]));

  return (
    <div className="space-y-4">
      {/* Zone 1: Collect New Reviews */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-brand-950">Review QR Poster</h2>
              <p className="mt-0.5 text-xs text-brand-500">
                Print for your counter, receipts, or packaging.
              </p>
            </div>
            {reviewUrl && (
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-950"
              >
                <span>Test</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          {!reviewUrl ? (
            <p className="mt-4 text-xs text-brand-500">
              Connect your Google Maps listing on the Overview tab to generate your QR poster and direct review link.
            </p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-surface-2 p-2">
                {effectiveQr ? (
                  <img
                    src={effectiveQr}
                    alt={`Google Review QR code for ${businessName}`}
                    className="h-full w-full rounded"
                  />
                ) : (
                  <QrCode className="h-8 w-8 text-brand-400" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <p className="truncate rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-brand-600">
                  {reviewUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    variant="primary"
                    onClick={handleDownloadPoster}
                    disabled={!effectiveQr}
                    icon={<Download size={12} />}
                  >
                    Download Poster
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    onClick={() => copyText(reviewUrl, "review-url")}
                    icon={copiedKey === "review-url" ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedKey === "review-url" ? "Copied" : "Copy Link"}
                  </ActionButton>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
          <div>
            <h2 className="text-sm font-semibold text-brand-950">Ask on WhatsApp</h2>
            <p className="mt-0.5 text-xs text-brand-500">
              Send this short note right after a happy customer visits or orders.
            </p>
            <p className="mt-3 whitespace-pre-wrap rounded-xl border border-brand-200 bg-surface-2 p-3 text-xs leading-relaxed text-brand-800">
              {whatsappMessage}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-xs font-semibold text-brand-50 transition hover:bg-brand-800"
            >
              <MessageSquare size={12} />
              <span>Send on WhatsApp</span>
              <ExternalLink size={11} />
            </a>
            <ActionButton
              variant="secondary"
              onClick={() => copyText(whatsappMessage, "wa-script")}
              icon={copiedKey === "wa-script" ? <Check size={12} /> : <Copy size={12} />}
            >
              {copiedKey === "wa-script" ? "Copied" : "Copy Message"}
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Zone 2: Recent Reviews & 1-Click AI Replies */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200/70 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-brand-950">
              Recent Google Reviews {reviews.length > 0 ? `(${reviews.length})` : ""}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              Replying promptly builds trust and improves local visibility.
            </p>
          </div>
          {reviews.length > 0 && (
            <ActionButton
              variant="primary"
              disabled={generatingCopilot}
              onClick={onGenerateCopilot}
              icon={
                generatingCopilot ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )
              }
            >
              {generatingCopilot
                ? "Drafting..."
                : copilot?.status === "READY"
                  ? "Refresh AI Replies"
                  : "Draft AI Replies"}
            </ActionButton>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-brand-500">
            No Google reviews found yet. Once your listing is connected and receives reviews, they’ll appear here.
          </div>
        ) : (
          <div className="divide-y divide-brand-100">
            {reviews.map((rev) => {
              const draft = replyMap.get(rev.name);
              return (
                <div key={rev.name} className="px-5 py-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-brand-950">{rev.authorName}</span>
                      {rev.rating != null && (
                        <Pill tone={rev.rating >= 4 ? "good" : rev.rating >= 3 ? "warn" : "bad"}>
                          <span className="inline-flex items-center gap-0.5">
                            <Star size={10} /> {rev.rating}
                          </span>
                        </Pill>
                      )}
                      {rev.relativePublishTime && (
                        <span className="text-[11px] text-brand-400">{rev.relativePublishTime}</span>
                      )}
                    </div>
                    <a
                      href={rev.googleMapsUri || manageProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-950"
                    >
                      <span>Reply on Google</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  <p className="text-[12.5px] leading-relaxed text-brand-700">
                    {rev.text || "Star rating only."}
                  </p>

                  {draft && (
                    <div className="rounded-xl border border-brand-200/70 bg-surface-2 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-500">
                          Suggested Reply
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyText(draft, `reply-${rev.name}`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2 py-0.5 text-[11px] font-semibold text-brand-900 hover:bg-brand-100/70 cursor-pointer"
                          >
                            {copiedKey === `reply-${rev.name}` ? (
                              <Check size={11} className="text-success-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedKey === `reply-${rev.name}` ? "Copied" : "Copy"}</span>
                          </button>
                          <a
                            href={manageProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:text-brand-950"
                          >
                            <span>Post</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-brand-800">{draft}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
