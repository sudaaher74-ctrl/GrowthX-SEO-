"use client";

import React, { useState } from "react";
import { AlertCircle, ChevronRight, Clock, Loader2, Settings2 } from "lucide-react";
import { GoogleGLogo } from "./gbp-icons";
import { GBP_PROVIDER, useAuthorizeGoogleProvider } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import type { GbpConnection } from "@/lib/api-client";

/** Where Google sends the browser back to once consent is done. */
export const GBP_RETURN_TO = "/google-business-profile";

interface ConnectWithGoogleButtonProps {
  projectId: string | null;
  /** The connection envelope, when the screen has one. Shapes what the button can honestly promise. */
  connection?: GbpConnection | null;
  label?: string;
  className?: string;
}

/**
 * The real "Connect with Google".
 *
 * It asks the backend for an authorization URL and sends the browser there;
 * Google then redirects back to `/google-business-profile?google=…`, which the
 * page reads to decide what to show next.
 *
 * Two states are handled before the customer can hit a wall with them: a
 * deployment with no Google credentials cannot start a consent flow at all, and
 * a Cloud project still waiting on Google's Business Profile approval will be
 * refused at the API rather than at the consent screen. Both are explained here
 * instead of being discovered as a 403 halfway through.
 */
export function ConnectWithGoogleButton({
  projectId,
  connection,
  label = "Connect with Google",
  className = "",
}: ConnectWithGoogleButtonProps) {
  const authorize = useAuthorizeGoogleProvider(projectId);
  const [failure, setFailure] = useState<string | null>(null);

  const handleConnect = () => {
    if (!projectId) return;
    setFailure(null);
    authorize.mutate(
      { provider: GBP_PROVIDER, returnTo: GBP_RETURN_TO },
      {
        onSuccess: ({ authorizationUrl }) => {
          // A full navigation, not a router push: the destination is Google.
          window.location.href = authorizationUrl;
        },
        onError: (err) => setFailure(errorMessage(err)),
      },
    );
  };

  if (connection && !connection.configured) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="w-full py-4 px-6 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 flex items-center justify-center gap-3">
          <Settings2 size={18} className="text-brand-400" />
          <span className="text-sm font-bold text-brand-600">Google sign-in is unavailable</span>
        </div>
        <p className="text-[11px] text-brand-500 text-center leading-relaxed">
          This deployment has not been given its Google OAuth credentials, so the consent flow cannot
          start. That is an operator setting, not something you can change here.
          {connection.statusMessage ? ` ${connection.statusMessage}` : ""}
        </p>
      </div>
    );
  }

  const awaitingApproval =
    connection?.state === "ERROR" && connection.requiresGoogleApproval;

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={handleConnect}
        disabled={authorize.isPending || !projectId}
        className="w-full py-4 px-6 rounded-xl border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-850 hover:bg-brand-50/70 dark:hover:bg-brand-800 hover:border-brand-300 transition-all flex items-center justify-center gap-3 group shadow-2xs disabled:opacity-60"
      >
        {authorize.isPending ? (
          <Loader2 size={18} className="animate-spin text-brand-500" />
        ) : (
          <GoogleGLogo size={20} />
        )}
        <span className="text-sm font-bold text-brand-900 dark:text-white">
          {authorize.isPending ? "Opening Google…" : label}
        </span>
        <ChevronRight
          size={17}
          className="text-blue-600 dark:text-blue-400 ml-1 group-hover:translate-x-0.5 transition-transform"
        />
      </button>

      {awaitingApproval && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 leading-relaxed dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <Clock size={13} className="shrink-0 mt-0.5" />
          <span>
            Google has not yet approved this deployment&apos;s access to the Business Profile APIs. You
            can sign in, but reads will keep being refused until that approval lands — it is decided by
            Google and typically takes days to weeks.
          </span>
        </div>
      )}

      {failure && (
        <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-2.5 text-[11px] text-error-800 leading-relaxed">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{failure}</span>
        </div>
      )}
    </div>
  );
}
