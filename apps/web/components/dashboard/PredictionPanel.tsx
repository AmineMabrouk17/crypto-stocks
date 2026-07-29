"use client";

import type { AssetRef, Candle } from "@crypto-stocks/lib";
import { formatCurrency } from "@crypto-stocks/lib";
import { TrendingUp, TrendingDown, Check, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { predictNextPrice } from "@/lib/pricePrediction";
import { useVoterId } from "@/lib/useVoterId";
import { cn } from "@/lib/utils";

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export function PredictionPanel({
  asset,
  candles,
  currentPrice,
}: {
  asset: AssetRef;
  candles: Candle[];
  currentPrice: number | null;
}) {
  const voterId = useVoterId();
  const [voting, setVoting] = useState(false);
  const predictedPrice = useMemo(() => predictNextPrice(candles.map((c) => c.close)), [candles]);

  const { data: counts, mutate: refreshCounts } = useSWR(
    voterId
      ? `/api/predictions/counts?symbol=${asset.symbol}&voter_id=${voterId}`
      : null,
    fetcher,
    { refreshInterval: 10_000 },
  );

  const direction =
    currentPrice != null && predictedPrice > 0
      ? currentPrice >= predictedPrice
        ? "up"
        : "down"
      : null;

  const handleVote = useCallback(
    async (dir: "up" | "down") => {
      if (!voterId) return;
      setVoting(true);
      try {
        await fetch("/api/predictions/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_symbol: asset.symbol,
            direction: dir,
            predicted_price: predictedPrice,
            voter_id: voterId,
          }),
        });
        refreshCounts();
      } finally {
        setVoting(false);
      }
    },
    [asset.symbol, voterId, predictedPrice, refreshCounts],
  );

  if (predictedPrice <= 0) return null;

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Next:
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {formatCurrency(predictedPrice)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            {counts?.up ?? 0}
          </span>
          <span className="flex items-center gap-1 font-mono tabular-nums text-red-600 dark:text-red-400">
            <TrendingDown className="h-3 w-3" />
            {counts?.down ?? 0}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleVote("up")}
            disabled={voting}
            aria-label="Predict up"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              counts?.userVote?.direction === "up"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-black/10 text-zinc-600 hover:bg-emerald-500/5 dark:border-white/15 dark:text-zinc-300",
            )}
          >
            <TrendingUp className="h-3 w-3" />
            Up
          </button>
          <button
            type="button"
            onClick={() => handleVote("down")}
            disabled={voting}
            aria-label="Predict down"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              counts?.userVote?.direction === "down"
                ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-black/10 text-zinc-600 hover:bg-red-500/5 dark:border-white/15 dark:text-zinc-300",
            )}
          >
            <TrendingDown className="h-3 w-3" />
            Down
          </button>
        </div>

        {counts?.userVote && direction && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-400 dark:text-zinc-500">You:</span>
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                counts.userVote.direction === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {counts.userVote.direction === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
            </span>
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                direction === counts.userVote.direction
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {direction === counts.userVote.direction ? (
                <>
                  <Check className="h-3 w-3" /> Right
                </>
              ) : (
                <>
                  <X className="h-3 w-3" /> Wrong
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
