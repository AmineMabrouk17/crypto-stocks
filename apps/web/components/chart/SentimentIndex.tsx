"use client";

import type { FearGreedIndex } from "@crypto-stocks/lib";
import useSWR from "swr";
import { Loader } from "../motion/loader";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CLASS_COLOR: Record<string, string> = {
  "Extreme Fear": "text-red-600 dark:text-red-400",
  Fear: "text-orange-600 dark:text-orange-400",
  Neutral: "text-amber-600 dark:text-amber-400",
  Greed: "text-lime-600 dark:text-lime-400",
  "Extreme Greed": "text-green-600 dark:text-green-400",
};

/** Market-wide Fear & Greed gauge (Alternative.me). 0 = Extreme Fear, 100 = Extreme Greed. */
export function SentimentIndex() {
  const { data, isLoading, error } = useSWR<FearGreedIndex>("/api/signals/sentiment", fetcher, {
    // The index updates daily; a slow client refresh is plenty.
    refreshInterval: 60 * 60 * 1000,
    revalidateOnFocus: true,
  });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Sentiment Index
        </span>
        {data && (
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              CLASS_COLOR[data.classification] ?? "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {data.value} · {data.classification}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Loader variant="dots" size={16} />
          Loading sentiment…
        </div>
      )}

      {!isLoading && (error || !data) && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Sentiment unavailable right now.</p>
      )}

      {data && <GaugeBar value={data.value} />}
    </div>
  );
}

function GaugeBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">0</span>
      <div className="relative h-2 flex-1 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-green-500">
        <span
          aria-hidden
          className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-zinc-900 shadow ring-1 ring-white/40 dark:bg-zinc-100 dark:ring-black/40"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">100</span>
    </div>
  );
}
