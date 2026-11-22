"use client";

import { AlertTriangle, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { formatUpdatedAgo, type PanelFailure } from "@/lib/api-error";
import { useNow } from "@/lib/usePanelQuery";
import { cn } from "@/lib/utils";
import { Loader } from "../motion/loader";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** What went wrong, with the cause spelled out. */
function failureCause(failure: PanelFailure, subject: string): string {
  switch (failure.kind) {
    case "offline":
      return "You're offline.";
    case "rate-limited":
      return `The ${subject} provider is rate limiting requests (HTTP 429).`;
    case "upstream":
      return `The ${subject} provider is having trouble (HTTP ${failure.status ?? "5xx"}).`;
    case "network":
      return `Couldn't reach the ${subject} service.`;
    default:
      return failure.status
        ? `Couldn't load ${subject} (HTTP ${failure.status}).`
        : `Couldn't load ${subject}.`;
  }
}

function failureCopy(failure: PanelFailure, subject: string, hasData: boolean): string {
  const cause = failureCause(failure, subject);
  if (hasData) return `${cause} Showing the last saved ${subject}.`;
  if (failure.kind === "offline") {
    return `${cause} ${capitalize(subject)} will reload when the connection comes back.`;
  }
  return `${cause} Try again in a moment.`;
}

interface PanelStatusProps {
  /** Lower-case noun used in copy, e.g. "news", "odds", "sentiment". */
  subject: string;
  /** True while the first payload is still loading. */
  loading: boolean;
  failure: PanelFailure | null;
  /** True once the panel has a value worth showing. */
  hasData: boolean;
  /** Copy for a successful-but-empty response. Omit when empty is impossible. */
  emptyMessage?: string;
  isRetrying: boolean;
  lastUpdatedAt: number | null;
  onRetry: () => void;
  className?: string;
}

/**
 * The one state block each panel renders under its header: loading, empty,
 * failure with a retry, or the "updated …" line. The only live region is the
 * visually hidden status line, so the updated-ago text ticking every 30s is
 * not re-announced, while loading → error → recovered transitions are.
 */
export function PanelStatus({
  subject,
  loading,
  failure,
  hasData,
  emptyMessage,
  isRetrying,
  lastUpdatedAt,
  onRetry,
  className,
}: PanelStatusProps) {
  const now = useNow();
  const updatedLabel =
    lastUpdatedAt !== null && now !== null ? formatUpdatedAgo(lastUpdatedAt, now) : null;
  const isEmpty = !loading && !failure && !hasData;

  const liveMessage = isRetrying
    ? `Retrying ${subject}…`
    : failure
      ? failureCopy(failure, subject, hasData)
      : isEmpty
        ? (emptyMessage ?? "")
        : loading && !hasData
          ? `Loading ${subject}…`
          : hasData
            ? `${capitalize(subject)} updated.`
            : "";

  const Icon = failure?.kind === "offline" ? WifiOff : AlertTriangle;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      {failure && hasData && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300",
            className,
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{failureCopy(failure, subject, true)}</span>
          <RetryButton onClick={onRetry} pending={isRetrying} label="Retry" />
        </div>
      )}

      {failure && !hasData && (
        <div className={cn("flex flex-col items-start gap-2 text-xs", className)}>
          <p className="flex items-start gap-2 leading-relaxed text-zinc-600 dark:text-zinc-300">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{failureCopy(failure, subject, false)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RetryButton onClick={onRetry} pending={isRetrying} label="Retry" />
            {updatedLabel && (
              <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                {updatedLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {isEmpty && emptyMessage && (
        <div className={cn("flex flex-col items-start gap-2 text-xs", className)}>
          <p className="leading-relaxed text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
          <RetryButton onClick={onRetry} pending={isRetrying} label="Check again" />
        </div>
      )}

      {!failure && loading && !hasData && (
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400",
            className,
          )}
        >
          <Loader variant="dots" size={16} />
          Loading {subject}…
        </div>
      )}

      {!failure && !loading && hasData && updatedLabel && (
        <p
          className={cn(
            "font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500",
            className,
          )}
        >
          {updatedLabel}
        </p>
      )}
    </>
  );
}

function RetryButton({
  onClick,
  pending,
  label,
}: {
  onClick: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-black/10 bg-white/70 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-600 transition hover:border-black/20 hover:text-zinc-900 disabled:cursor-progress disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:border-white/20 dark:hover:text-white"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-3 w-3" aria-hidden />
      )}
      {pending ? "Retrying…" : label}
    </button>
  );
}
