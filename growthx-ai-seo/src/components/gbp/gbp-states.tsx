"use client";

import React from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  Settings2,
  ShieldAlert,
  MapPin,
} from "lucide-react";
import { GoogleGLogo } from "./gbp-icons";
import { errorMessage } from "@/lib/error-message";
import type { GbpConnection, GbpEnvelope, GbpSource } from "@/lib/api-client";

/**
 * The honest states, in one place.
 *
 * Eight tabs read the same two envelopes, and each of them has to distinguish
 * "not connected", "connected but never synced", "synced and this merchant
 * genuinely has none of these", and "Google refuses this Cloud project this
 * source". Written once here so a tab cannot quietly collapse four answers
 * into an empty list.
 */

/** Human-readable name for a source the backend reports by its internal key. */
export const GBP_SOURCE_LABELS: Record<string, string> = {
  profile: "Profile details",
  performance: "Performance metrics",
  reviews: "Reviews",
  media: "Photos",
  posts: "Posts",
};

export function formatGbpTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d MMM yyyy, h:mm a");
}

/** Renders a metric Google never reported as an em dash rather than as zero. */
export function metricValue(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString();
}

interface PanelProps {
  /** Lucide icons and the Google mark share this shape. */
  icon: React.ComponentType<{ size?: number }>;
  tone?: "neutral" | "warning" | "danger" | "info";
  title: string;
  body: React.ReactNode;
  detail?: string | null;
  action?: { label: string; onClick: () => void; pending?: boolean };
  compact?: boolean;
}

const TONES: Record<NonNullable<PanelProps["tone"]>, string> = {
  neutral: "bg-brand-50 text-brand-600",
  info: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
};

/** The card every state below renders into, so they all look like one thing. */
export function GbpStatePanel({
  icon: Icon,
  tone = "neutral",
  title,
  body,
  detail,
  action,
  compact = false,
}: PanelProps) {
  return (
    <div
      className={`rounded-2xl border bg-white shadow-xs flex flex-col items-center text-center gap-3 ${
        compact ? "p-6" : "p-10"
      }`}
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${TONES[tone]}`}>
        <Icon size={22} />
      </div>
      <h2 className="text-sm font-bold text-brand-950">{title}</h2>
      <div className="text-xs text-brand-500 max-w-md leading-relaxed">{body}</div>
      {detail && (
        <p className="text-[11px] text-brand-400 max-w-md leading-relaxed border-t border-brand-100 pt-2.5">
          {detail}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.pending}
          className="inline-flex items-center gap-1.5 mt-1 px-3.5 py-2 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {action.pending && <Loader2 size={12} className="animate-spin" />}
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ConnectionNoticeProps {
  connection: GbpConnection | null | undefined;
  onConnect?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
  compact?: boolean;
}

/**
 * The connection-level answer, or null when the connection is fine and the tab
 * should render its own data.
 *
 * `requiresGoogleApproval` with `ERROR` is treated as a first-class state
 * rather than as a failure: on a fresh deployment it is the *expected* answer
 * for days or weeks while Google reviews the Business Profile API request, and
 * it is not something the customer's own setup can fix.
 */
export function GbpConnectionNotice({
  connection,
  onConnect,
  onChooseLocation,
  onSync,
  isSyncing,
  compact,
}: ConnectionNoticeProps): React.ReactElement | null {
  if (!connection) return null;

  if (!connection.configured) {
    return (
      <GbpStatePanel
        compact={compact}
        icon={Settings2}
        tone="danger"
        title="Google is not configured on this deployment"
        detail={connection.statusMessage}
        body={
          <>
            This is an operator problem, not something you can fix from here. GrowthX cannot start a
            Google connection until this deployment is given its Google OAuth credentials. Ask whoever
            runs this environment to add them, then reload this page.
          </>
        }
      />
    );
  }

  switch (connection.state) {
    case "NOT_CONNECTED":
      return (
        <GbpStatePanel
          compact={compact}
          icon={GoogleGLogo}
          tone="info"
          title="No Google Business Profile connected"
          body={
            <>
              Nothing has been read from Google for this project yet. Connect the Google account that
              manages your business listing to pull in your profile, reviews, photos, posts and
              performance figures.
            </>
          }
          action={onConnect ? { label: "Connect with Google", onClick: onConnect } : undefined}
        />
      );

    case "NEEDS_SELECTION":
      return (
        <GbpStatePanel
          compact={compact}
          icon={MapPin}
          tone="info"
          title="Choose which location this project tracks"
          body={
            <>
              Your Google account is connected, but no business location has been picked yet. Nothing
              can be synced until GrowthX knows which listing to read.
            </>
          }
          action={
            onChooseLocation ? { label: "Choose a location", onClick: onChooseLocation } : undefined
          }
        />
      );

    case "NEEDS_REAUTH":
      return (
        <GbpStatePanel
          compact={compact}
          icon={Lock}
          tone="warning"
          title="Google needs you to sign in again"
          detail={connection.statusMessage}
          body={
            <>
              The permission GrowthX was granted is no longer valid — usually because it was revoked in
              your Google account, or a required permission was declined. Reconnect to resume syncing.
            </>
          }
          action={onConnect ? { label: "Reconnect with Google", onClick: onConnect } : undefined}
        />
      );

    case "ERROR":
      return connection.requiresGoogleApproval ? (
        <GbpStatePanel
          compact={compact}
          icon={Clock}
          tone="warning"
          title="Waiting on Google to approve API access"
          detail={connection.statusMessage}
          body={
            <>
              Your connection is set up correctly. The Business Profile APIs sit behind an application
              review that Google grants per Cloud project, and this one has not been granted yet.
              Approval is decided on Google&apos;s side and typically takes several days to a few weeks
              — there is nothing wrong with your account or your listing, and nothing further for you
              to do until it lands. Data will appear on the next sync after Google grants access.
            </>
          }
          action={onSync ? { label: "Try syncing again", onClick: onSync, pending: isSyncing } : undefined}
        />
      ) : (
        <GbpStatePanel
          compact={compact}
          icon={ShieldAlert}
          tone="danger"
          title="The last read from Google failed"
          detail={connection.statusMessage}
          body={<>GrowthX could not read this profile the last time it tried. Retry the sync below.</>}
          action={onSync ? { label: "Try syncing again", onClick: onSync, pending: isSyncing } : undefined}
        />
      );

    case "NEVER_SYNCED":
      return (
        <GbpStatePanel
          compact={compact}
          icon={RefreshCw}
          tone="info"
          title="Connected, but nothing has been synced yet"
          body={
            <>
              {connection.selectedResourceName
                ? `${connection.selectedResourceName} is linked`
                : "Your location is linked"}{" "}
              and no sync has run for it. Run the first one to pull your profile, reviews, photos, posts
              and performance figures out of Google.
            </>
          }
          action={onSync ? { label: "Sync now", onClick: onSync, pending: isSyncing } : undefined}
        />
      );

    default:
      return null;
  }
}

interface SourceNoticeProps {
  source: GbpSource | null | undefined;
  /** What this tab is showing, e.g. "Photos". */
  label: string;
  /** Rendered when Google was read successfully and there genuinely are none. */
  emptyTitle: string;
  emptyBody: React.ReactNode;
  onSync?: () => void;
  isSyncing?: boolean;
  compact?: boolean;
}

/**
 * The source-level answer for a tab whose list came back empty.
 *
 * A refusal never renders as an empty list: "Google will not let this project
 * read photos" and "this business has no photos" are opposite facts, and only
 * one of them is the merchant's to act on.
 */
export function GbpSourceNotice({
  source,
  label,
  emptyTitle,
  emptyBody,
  onSync,
  isSyncing,
  compact,
}: SourceNoticeProps): React.ReactElement {
  if (source?.state === "UNAVAILABLE") {
    const pendingApproval = source.httpStatus === 403 || source.httpStatus === 401;
    return (
      <GbpStatePanel
        compact={compact}
        icon={AlertTriangle}
        tone="warning"
        title={`${label} are unavailable`}
        detail={source.message}
        body={
          pendingApproval ? (
            <>
              Google refused this source. {label} come from the legacy Business Profile API, and this
              deployment&apos;s Google Cloud project has not been granted access to it. This is a
              Google-side approval, not a problem with your listing — everything else on this profile
              keeps syncing meanwhile.
            </>
          ) : (
            <>
              Google would not return {label.toLowerCase()} on the last sync. This is not an empty
              profile: nothing was read, so nothing can be shown.
            </>
          )
        }
        action={onSync ? { label: "Try syncing again", onClick: onSync, pending: isSyncing } : undefined}
      />
    );
  }

  if (!source || source.state === "NEVER_ATTEMPTED") {
    return (
      <GbpStatePanel
        compact={compact}
        icon={RefreshCw}
        tone="info"
        title={`${label} have never been read`}
        body={
          <>
            No sync has tried to read {label.toLowerCase()} for this location yet, which is not the same
            as having looked and found none.
          </>
        }
        action={onSync ? { label: "Sync now", onClick: onSync, pending: isSyncing } : undefined}
      />
    );
  }

  // source.state === "OK" with nothing to show: Google was read, and there
  // genuinely are none.
  return (
    <GbpStatePanel
      compact={compact}
      icon={AlertTriangle}
      tone="neutral"
      title={emptyTitle}
      body={emptyBody}
    />
  );
}

/**
 * True when a tab should render its own data rather than a connection notice.
 * NEVER_SYNCED is deliberately excluded: it has no data yet, only a next step.
 */
export function gbpHasSyncedData(connection: GbpConnection | null | undefined): boolean {
  return connection?.state === "SYNCED";
}

interface TabGateProps<T extends GbpEnvelope> {
  query: { data: T | undefined; isLoading: boolean; isError: boolean; error: unknown };
  /** What this tab is loading, for the loading and failure lines. */
  label: string;
  onConnect?: () => void;
  onChooseLocation?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
  children: (data: T) => React.ReactNode;
}

/**
 * The preamble every Business Profile tab shares: loading, a failed request,
 * and the connection-level answer — before a tab is allowed to render figures.
 *
 * A tab only receives `data` once the connection says SYNCED, so there is no
 * path on which a tab renders numbers over a connection that never delivered
 * any.
 */
export function GbpTabGate<T extends GbpEnvelope>({
  query,
  label,
  onConnect,
  onChooseLocation,
  onSync,
  isSyncing,
  children,
}: TabGateProps<T>): React.ReactElement {
  if (query.isLoading) {
    return (
      <div
        className="rounded-2xl border bg-white p-10 shadow-xs flex flex-col items-center gap-3 text-center"
        style={{ borderColor: "var(--border-color)" }}
      >
        <Loader2 size={22} className="animate-spin text-brand-400" />
        <p className="text-xs text-brand-500">Loading {label.toLowerCase()}…</p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <GbpStatePanel
        icon={ShieldAlert}
        tone="danger"
        title={`${label} could not be loaded`}
        body={
          <>
            GrowthX could not reach its own API for this tab, so nothing is shown rather than something
            approximate.
          </>
        }
        detail={query.error ? errorMessage(query.error) : null}
      />
    );
  }

  const notice = (
    <GbpConnectionNotice
      connection={query.data.connection}
      onConnect={onConnect}
      onChooseLocation={onChooseLocation}
      onSync={onSync}
      isSyncing={isSyncing}
    />
  );
  if (notice) return notice;

  return <>{children(query.data)}</>;
}
