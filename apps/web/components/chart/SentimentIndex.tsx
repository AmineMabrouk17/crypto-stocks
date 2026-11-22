"use client";

import type { FearGreedIndex } from "@crypto-stocks/lib";
import { fetchJson } from "@/lib/api-error";
import { usePanelQuery } from "@/lib/usePanelQuery";
import { cn } from "@/lib/utils";
import { PanelStatus } from "../feedback/PanelStatus";

async function fetchSentiment(): Promise<FearGreedIndex> {
  const payload = await fetchJson<FearGreedIndex>("/api/signals/sentiment");
  // A 200 that isn't a reading is a failure, not a zero.
  if (typeof payload.value !== "number" || typeof payload.classification !== "string") {
    throw new Error("Unexpected sentiment response");
  }
  return payload;
}

const CLASS_COLOR: Record<string, string> = {
  "Extreme Fear": "text-signal-down border-rose-500/30 bg-rose-500/10",
  Fear: "text-orange-700 border-orange-500/30 bg-orange-500/10 dark:text-orange-400",
  Neutral: "text-signal-neutral border-amber-500/30 bg-amber-500/10",
  Greed: "text-signal-up border-emerald-500/30 bg-emerald-500/10",
  "Extreme Greed": "text-signal-up border-emerald-500/30 bg-emerald-500/10",
};

export function SentimentIndex() {
  // The Fear & Greed index updates daily, so a slow refresh is plenty.
  const { data, failure, isLoading, isStale, isRetrying, lastUpdatedAt, retry } =
    usePanelQuery<FearGreedIndex>("/api/signals/sentiment", fetchSentiment, {
      refreshInterval: 60 * 60 * 1000,
      revalidateOnFocus: true,
    });

  return (
    <div className="glass-tile flex h-full flex-col gap-3 rounded-3xl p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Sentiment Index
        </span>
        {data && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-bold transition-opacity duration-200",
              CLASS_COLOR[data.classification] ??
                "border-black/10 bg-black/[0.03] text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300",
              isStale && "opacity-60",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
            {data.value} · {data.classification}
          </span>
        )}
      </div>

      <PanelStatus
        subject="sentiment"
        loading={isLoading}
        failure={failure}
        hasData={Boolean(data)}
        isRetrying={isRetrying}
        lastUpdatedAt={lastUpdatedAt}
        onRetry={retry}
        className={data ? undefined : "flex-1 justify-center py-3"}
      />

      {data && (
        <div
          aria-busy={isStale || undefined}
          className={cn("flex flex-1 flex-col transition-opacity duration-200", isStale && "opacity-60")}
        >
          <GaugeBar value={data.value} />
        </div>
      )}
    </div>
  );
}

function GaugeBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="flex flex-1 items-center gap-2 py-3">
      <span className="font-mono text-xs font-semibold text-signal-down">0</span>
      <div className="relative h-3 flex-1 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 p-[1px] shadow-inner">
        <div className="h-full w-full rounded-full bg-white/60 dark:bg-[#0d101a]/40" />
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900 shadow-lg ring-2 ring-emerald-400 dark:border-zinc-900 dark:ring-emerald-400"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <span className="font-mono text-xs font-semibold text-signal-up">100</span>
    </div>
  );
}
