"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, Loader2, MessageSquare, QrCode, Star } from "lucide-react";
import { ActionButton, Panel, Pill } from "@/components/ui/console";
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
    let active = true;
    if (!reviewUrl) {
      setQrDataUrl(null);
      return;
    }
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
    ? `Hi! Thank you for choosing ${businessName}. If you loved our product/service, could you spare 20 seconds to leave us a quick Google review? Mentioning what you ordered and your area really helps local neighbors find us:\n${reviewUrl}`
    : `Hi! Thank you for choosing ${businessName}. Connect your Google Maps listing in Reigel to generate your 1-tap Google review link automatically.`;

  const whatsappMessage = copilot?.whatsappReviewRequest || defaultWhatsappScript;

  const handleDownloadPoster = async () => {
    if (!reviewUrl || !qrDataUrl) return;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pure canvas print poster (no hardcoded hex strings)
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
    ctx.fillText("Scan the QR code to review us on Google", canvas.width / 2, 345);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("QR image failed"));
      img.src = qrDataUrl;
    });
    const qrSize = 500;
    ctx.drawImage(img, (canvas.width - qrSize) / 2, 405, qrSize, qrSize);

    ctx.fillStyle = "rgb(15, 23, 42)";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("Tip: Mention your favorite product & neighborhood!", canvas.width / 2, 980);

    if (domain) {
      ctx.fillStyle = "rgb(100, 116, 139)";
      ctx.font = "22px monospace";
      ctx.fillText(domain, canvas.width / 2, 1055);
    }

    const link = document.createElement("a");
    link.download = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-google-review-qr-poster.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const replyMap = new Map((copilot?.reviewReplies ?? []).map((r) => [r.reviewName, r.suggestedReply]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="1-Tap Google Review Link & Printable QR Poster"
          subtitle="Print for delivery bags, invoices, or your counter — customers scan and review in 15 seconds"
          padded
        >
          {!reviewUrl ? (
            <p className="text-[12.5px] text-brand-500">
              Connect your Google Maps listing on the Overview tab to automatically generate your direct Google review link and printable QR code poster.
            </p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center justify-center rounded-xl border border-brand-200 bg-surface-0 p-3 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Google Review QR Code for ${businessName}`}
                    className="h-36 w-36 rounded"
                  />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center text-brand-400">
                    <QrCode size={40} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                    Direct Google Review URL
                  </p>
                  <p className="mt-1 break-all rounded-lg border border-brand-200 bg-brand-50/70 px-2.5 py-2 font-mono text-[11px] text-brand-950">
                    {reviewUrl}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    variant="secondary"
                    onClick={() => copyText(reviewUrl, "review-url")}
                    icon={copiedKey === "review-url" ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedKey === "review-url" ? "Copied Link" : "Copy Review Link"}
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    onClick={handleDownloadPoster}
                    disabled={!qrDataUrl}
                    icon={<Download size={12} />}
                  >
                    Download Printable QR Poster (.png)
                  </ActionButton>
                  <a
                    href={reviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-0 px-2.5 py-1.5 text-[11.5px] font-semibold text-brand-800 hover:bg-brand-50"
                  >
                    <span>Test Link</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="WhatsApp Customer Review Request Script"
          subtitle="Send after happy orders or visits — nudges buyers to mention your product and neighborhood (boosts local & AI rank)"
          padded
        >
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap rounded-lg border border-brand-200 bg-brand-50/70 p-3 font-sans text-[12px] leading-relaxed text-brand-950">
              {whatsappMessage}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                variant="secondary"
                onClick={() => copyText(whatsappMessage, "wa-script")}
                icon={copiedKey === "wa-script" ? <Check size={12} /> : <Copy size={12} />}
              >
                {copiedKey === "wa-script" ? "Copied Script" : "Copy WhatsApp Message"}
              </ActionButton>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-0 px-2.5 py-1.5 text-[11.5px] font-semibold text-brand-800 hover:bg-brand-50"
              >
                <MessageSquare size={12} />
                <span>Open in WhatsApp</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title={`Public Google Maps Reviews (${reviews.length} featured)`}
        subtitle="Google Places exposes your 5 most relevant public reviews — draft tailored replies and paste directly in Google Business Profile"
        actions={
          <ActionButton
            variant="primary"
            disabled={generatingCopilot}
            onClick={onGenerateCopilot}
            icon={generatingCopilot ? <Loader2 size={12} className="animate-spin" /> : undefined}
          >
            {generatingCopilot
              ? "Drafting Replies..."
              : copilot?.status === "READY"
                ? "Regenerate AI Replies"
                : "Draft AI Replies for Reviews"}
          </ActionButton>
        }
        padded
      >
        {reviews.length === 0 ? (
          <p className="text-[12.5px] text-brand-500">
            No public Google reviews loaded yet. Connect your Google Maps listing on the Overview tab to inspect recent reviews and draft replies.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => {
              const draft = replyMap.get(rev.name);
              return (
                <div key={rev.name} className="rounded-xl border border-brand-200 p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-brand-950">{rev.authorName}</p>
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
                      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-700 hover:underline"
                    >
                      <span>Reply on Google</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-brand-700">
                    {rev.text || "Star rating only (no written comment)."}
                  </p>
                  {draft && (
                    <div className="rounded-lg border border-brand-200/80 bg-brand-50/70 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-accent-700">
                          AI Suggested Owner Reply
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyText(draft, `reply-${rev.name}`)}
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-0 px-2 py-0.5 text-[11px] font-semibold text-brand-900 hover:bg-brand-100 cursor-pointer"
                          >
                            {copiedKey === `reply-${rev.name}` ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                            <span>{copiedKey === `reply-${rev.name}` ? "Copied" : "Copy Reply"}</span>
                          </button>
                          <a
                            href={manageProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-0 px-2 py-0.5 text-[11px] font-semibold text-accent-700 hover:bg-brand-100"
                          >
                            <span>Open GBP</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                      <p className="text-[12px] leading-relaxed text-brand-950">{draft}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
