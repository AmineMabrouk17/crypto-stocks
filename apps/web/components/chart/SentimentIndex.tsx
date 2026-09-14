"use client";

import type { FearGreedIndex } from "@crypto-stocks/lib";
import useSWR from "swr";
import { Loader } from "../motion/loader";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CLASS_COLOR: Record<string, string> = {
  "Extreme Fear": "text-rose-400 border-rose-500/30 bg-rose-500/10",
  Fear: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  Neutral: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  Greed: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "Extreme Greed": "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
};

export function SentimentIndex() {
  // The Fear & Greed index updates daily, so a slow refresh is plenty.
  const { data, isLoading, error } = useSWR<FearGreedIndex>("/api/signals/sentiment", fetcher, {
    refreshInterval: 60 * 60 * 1000,
    revalidateOnFocus: true,
  });

  return (
    <div className="glass-tile flex h-full flex-col gap-3 rounded-3xl p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Sentiment Index
        </span>
        {data && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-bold ${
              CLASS_COLOR[data.classification] ??
              "border-black/10 bg-black/[0.03] text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
            {data.value} · {data.classification}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-1 items-center gap-2 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          <Loader variant="dots" size={16} />
          Loading sentiment…
        </div>
      )}

      {!isLoading && (error || !data) && (
        <p className="flex flex-1 items-center py-3 text-xs text-zinc-500 dark:text-zinc-400">
          Sentiment unavailable right now.
        </p>
      )}

      {data && <GaugeBar value={data.value} />}
    </div>
  );
}

function GaugeBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="flex flex-1 items-center gap-2 py-3">
      <span className="font-mono text-[10px] font-semibold text-rose-400">0</span>
      <div className="relative h-3 flex-1 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 p-[1px] shadow-inner">
        <div className="h-full w-full rounded-full bg-white/60 dark:bg-[#0d101a]/40" />
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900 shadow-lg ring-2 ring-emerald-400 dark:border-zinc-900 dark:ring-emerald-400"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <span className="font-mono text-[10px] font-semibold text-emerald-400">100</span>
    </div>
  );
}
