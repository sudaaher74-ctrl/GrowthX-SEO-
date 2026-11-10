"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles, Building2, UploadCloud, Palette, Phone, FileText, AlertTriangle, ArrowRight, ShieldCheck, Eye } from "lucide-react";
import { useWorkspace, useWhiteLabel, useUpdateWhiteLabel } from "@/hooks/use-growthx";
import { useSubscription } from "@/lib/subscription-engine";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Emerald", hex: "#059669" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Amber", hex: "#d97706" },
  { name: "Cyan", hex: "#0891b2" },
  { name: "Dark Slate", hex: "#1e293b" },
];

export function WhiteLabelSettingsCard({ onNavigateSubscription }: { onNavigateSubscription?: () => void }) {
  const { orgId } = useWorkspace();
  const { subscription, plan } = useSubscription(orgId);
  const isAgency = subscription?.tierId === "agency";

  const { data: whiteLabel, isLoading } = useWhiteLabel(orgId);
  const updateMutation = useUpdateWhiteLabel(orgId);

  const [enabled, setEnabled] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#4f46e5");
  const [contactLine, setContactLine] = useState("");
  const [footerText, setFooterText] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (whiteLabel) {
      setEnabled(Boolean(whiteLabel.whiteLabelEnabled));
      setAgencyName(whiteLabel.agencyName || "");
      setLogoUrl(whiteLabel.logoUrl || "");
      setBrandColor(whiteLabel.brandColor || "#4f46e5");
      setContactLine(whiteLabel.contactLine || "");
      setFooterText(whiteLabel.footerText || "");
    }
  }, [whiteLabel]);

  const handleSave = async () => {
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      await updateMutation.mutateAsync({
        whiteLabelEnabled: isAgency ? enabled : false,
        agencyName: agencyName.trim() || null,
        logoUrl: logoUrl.trim() || null,
        brandColor: brandColor.trim() || "#4f46e5",
        contactLine: contactLine.trim() || null,
        footerText: footerText.trim() || null,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save white-label settings.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Plan Quota Alert for Non-Agency Users */}
      {!isAgency && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-warning-300/60 bg-warning-50/70 p-4 dark:border-warning-900/50 dark:bg-warning-950/20">
          <div className="flex gap-3">
            <div className="rounded-lg bg-warning-500/10 p-2 text-warning-600 dark:text-warning-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-950 dark:text-white">
                Agency Plan Feature
              </h3>
              <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-300">
                White-label reports, custom logo substitution, and complete removal of Reigel branding require the{" "}
                <span className="font-semibold text-brand-900 dark:text-brand-100">Agency Plan</span>. Your organization is currently on the{" "}
                <span className="font-bold uppercase tracking-wider text-warning-700 dark:text-warning-300">{plan?.name ?? "Starter"}</span>.
              </p>
            </div>
          </div>
          {onNavigateSubscription && (
            <button
              type="button"
              onClick={onNavigateSubscription}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-warning-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-warning-700 cursor-pointer"
            >
              <span>Upgrade to Agency</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Main Settings Form */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-xs dark:border-brand-800/60">
        <div className="flex items-center justify-between border-b border-brand-200/60 pb-4 dark:border-brand-800/40">
          <div>
            <h2 className="text-base font-bold text-brand-950 dark:text-white flex items-center gap-2">
              <Building2 size={18} className="text-brand-600 dark:text-brand-400" />
              <span>Agency White-Label Branding</span>
            </h2>
            <p className="text-xs text-brand-500 dark:text-brand-400 mt-0.5">
              Customize client-facing reports (Monthly SEO Report and Competitor Intel PDF) with your agency's branding.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-brand-600 dark:text-brand-300">
              {enabled ? "White-Label Active" : "Default Reigel Branding"}
            </span>
            <button
              type="button"
              disabled={!isAgency || isLoading}
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                enabled ? "bg-signal-500" : "bg-brand-200 dark:bg-brand-800",
                (!isAgency || isLoading) && "opacity-50 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  enabled ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Agency Name */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 dark:text-brand-200">
              Agency / Organization Name
            </label>
            <p className="text-[11px] text-brand-500 mb-1.5">
              Replaces "GrowthX / Reigel AI" on executive report headers.
            </p>
            <input
              type="text"
              disabled={!isAgency}
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g. Zenith Digital Partners"
              className="w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-medium text-brand-950 placeholder-brand-400 focus:border-brand-500 focus:outline-hidden dark:border-brand-800 dark:text-white"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 dark:text-brand-200">
              Agency Logo URL
            </label>
            <p className="text-[11px] text-brand-500 mb-1.5">
              Direct HTTPS link or data URI to your high-resolution PNG/SVG logo.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                disabled={!isAgency}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://youragency.com/logo.png"
                className="flex-1 rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-medium text-brand-950 placeholder-brand-400 focus:border-brand-500 focus:outline-hidden dark:border-brand-800 dark:text-white"
              />
              {logoUrl && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-white p-1 dark:border-brand-800">
                  <img src={logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          </div>

          {/* Brand Accent Color */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 dark:text-brand-200">
              Brand Accent Color
            </label>
            <p className="text-[11px] text-brand-500 mb-1.5">
              Used for report borders, key metrics, and highlight accents.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                disabled={!isAgency}
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-8 w-9 cursor-pointer rounded-md border border-brand-200 bg-surface-2 p-0.5 dark:border-brand-800"
              />
              <input
                type="text"
                disabled={!isAgency}
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#4f46e5"
                className="w-28 rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 font-mono text-xs font-bold text-brand-950 uppercase dark:border-brand-800 dark:text-white"
              />
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    disabled={!isAgency}
                    onClick={() => setBrandColor(preset.hex)}
                    title={preset.name}
                    style={{ backgroundColor: preset.hex }}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform hover:scale-110 cursor-pointer",
                      brandColor.toLowerCase() === preset.hex.toLowerCase() && "ring-2 ring-brand-950 dark:ring-white ring-offset-1",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Contact Line */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 dark:text-brand-200">
              Agency Contact Line
            </label>
            <p className="text-[11px] text-brand-500 mb-1.5">
              Displayed in report header and sign-off block.
            </p>
            <input
              type="text"
              disabled={!isAgency}
              value={contactLine}
              onChange={(e) => setContactLine(e.target.value)}
              placeholder="e.g. reports@zenith.in · +91 98200 12345 · zenith.in"
              className="w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-medium text-brand-950 placeholder-brand-400 focus:border-brand-500 focus:outline-hidden dark:border-brand-800 dark:text-white"
            />
          </div>

          {/* Footer Text */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-brand-800 dark:text-brand-200">
              Custom Footer &amp; Disclaimers (Optional)
            </label>
            <p className="text-[11px] text-brand-500 mb-1.5">
              Replaces the default Reigel autonomous certification statement at the bottom of client deliverables.
            </p>
            <textarea
              rows={2}
              disabled={!isAgency}
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. Confidential client deliverable prepared by Zenith Digital. All metrics verified via direct Google Search Console and Analytics API feeds."
              className="w-full rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-medium text-brand-950 placeholder-brand-400 focus:border-brand-500 focus:outline-hidden dark:border-brand-800 dark:text-white"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="mt-3 text-xs font-medium text-error-600 dark:text-error-400">
            {errorMsg}
          </p>
        )}

        {/* Action Button */}
        <div className="mt-5 flex items-center justify-between border-t border-brand-200/60 pt-4 dark:border-brand-800/40">
          <div className="flex items-center gap-2 text-xs text-brand-500">
            {enabled && isAgency ? (
              <span className="flex items-center gap-1.5 text-success-600 dark:text-success-400 font-medium">
                <Check size={14} /> Reigel branding suppressed for all PDF exports
              </span>
            ) : (
              <span>Reigel standard branding will be shown on generated PDFs</span>
            )}
          </div>

          <button
            type="button"
            disabled={!isAgency || updateMutation.isPending}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-signal-500 px-4 py-2 text-xs font-bold text-signal-ink shadow-xs transition hover:bg-signal-400 disabled:opacity-50 cursor-pointer"
          >
            {updateMutation.isPending ? "Saving Settings..." : savedSuccess ? "Settings Saved ✓" : "Save White-Label Settings"}
          </button>
        </div>
      </div>

      {/* Live Visual Preview of Deliverable */}
      <div className="rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-xs dark:border-brand-800/60">
        <div className="flex items-center justify-between pb-3 border-b border-brand-200/60 dark:border-brand-800/40">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300 flex items-center gap-2">
            <Eye size={15} />
            <span>Client Deliverable Live Preview</span>
          </h3>
          <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-600">
            PDF &amp; Print Header
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-brand-200 bg-white p-5 shadow-inner dark:border-brand-800 dark:bg-brand-950/40">
          <div
            className="flex items-start justify-between pb-4 border-b-2"
            style={{ borderColor: enabled && agencyName ? brandColor : "var(--color-brand-900)" }}
          >
            <div className="flex items-start gap-3">
              {enabled && logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 max-w-[140px] object-contain rounded" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white font-bold font-mono text-sm"
                  style={{ backgroundColor: enabled && agencyName ? brandColor : "var(--color-brand-950)" }}
                >
                  {(agencyName || "R").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <span
                  className="text-[10px] font-black uppercase tracking-widest font-mono"
                  style={{ color: enabled && agencyName ? brandColor : "var(--color-brand-500)" }}
                >
                  {enabled && agencyName ? `${agencyName} · Executive Deliverable` : "GrowthX SEO · Executive Client Deliverable"}
                </span>
                <h4 className="text-base font-extrabold text-brand-950 dark:text-white">
                  Monthly SEO Performance &amp; AI Visibility Report
                </h4>
                <p className="text-[11px] text-brand-600 font-mono mt-0.5">
                  Target Property: <span className="font-bold text-brand-950 dark:text-white">example.in</span> · Period: <span className="font-bold">October 2026</span>
                </p>
                {enabled && contactLine && (
                  <p className="text-[10px] text-brand-500 font-mono mt-1">
                    {contactLine}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right font-mono text-[10px] text-brand-500">
              <p className="font-bold uppercase text-brand-900 dark:text-brand-100">REP-2026-10-AUDIT</p>
              <p className="mt-0.5 text-success-600 font-bold">Status: Formally Verified</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-brand-500 pt-2">
            <span>
              {enabled && footerText
                ? footerText
                : "Autonomous Verification Stamp · Programmatically certified by Reigel AI SEO Autonomous Engine."}
            </span>
            <span className="font-bold text-brand-700 dark:text-brand-300">
              {enabled && agencyName ? `Prepared by ${agencyName}` : "Powered by Reigel AI SEO"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
