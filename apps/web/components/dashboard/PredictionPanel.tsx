"use client";

import type { AssetRef, Candle } from "@crypto-stocks/lib";
import { formatCurrency } from "@crypto-stocks/lib";
import { TrendingUp, TrendingDown, Check, X, Clock } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [confirmedDir, setConfirmedDir] = useState<"up" | "down" | null>(null);
  const [votedAtPrice, setVotedAtPrice] = useState<number | null>(null);
  const predictedPrice = useMemo(() => predictNextPrice(candles.map((c) => c.close)), [candles]);

  const { data: counts, mutate: refreshCounts } = useSWR(
    voterId
      ? `/api/predictions/counts?symbol=${asset.symbol}&voter_id=${voterId}`
      : null,
    fetcher,
    { refreshInterval: 10_000 },
  );

  const userVote = counts?.userVote?.direction ?? confirmedDir;

  const priceChangeSinceVote =
    votedAtPrice != null && currentPrice != null
      ? currentPrice - votedAtPrice
      : null;

  const priceChangePercent =
    priceChangeSinceVote != null && votedAtPrice != null && votedAtPrice > 0
      ? (priceChangeSinceVote / votedAtPrice) * 100
      : null;

  const isCorrect =
    userVote && priceChangeSinceVote != null
      ? (userVote === "up" && priceChangeSinceVote >= 0) ||
        (userVote === "down" && priceChangeSinceVote < 0)
      : null;

  const handleVote = useCallback(
    async (dir: "up" | "down") => {
      if (!voterId) return;
      setSubmitting(true);
      setConfirmedDir(dir);
      setVotedAtPrice(currentPrice);
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
        setSubmitting(false);
      }
    },
    [asset.symbol, voterId, predictedPrice, currentPrice, refreshCounts],
  );

  if (predictedPrice <= 0) return null;

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Price Prediction
          </span>
          <span className="hidden rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:bg-white/10 dark:text-zinc-400 sm:inline">
            next candle
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

      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Forecast:</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
          {formatCurrency(predictedPrice)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!userVote ? (
          <>
            <span className="mr-1 text-xs text-zinc-400 dark:text-zinc-500">Will price go?</span>
            <button
              type="button"
              onClick={() => handleVote("up")}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              <TrendingUp className="h-3 w-3" />
              Up
            </button>
            <button
              type="button"
              onClick={() => handleVote("down")}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
            >
              <TrendingDown className="h-3 w-3" />
              Down
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 dark:text-zinc-500">You predicted:</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold",
                  userVote === "up"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
                )}
              >
                {userVote === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {userVote === "up" ? "Up" : "Down"}
              </span>
            </div>

            <span className="text-zinc-300 dark:text-zinc-600">|</span>

            <button
              type="button"
              onClick={() => {
                setConfirmedDir(null);
                setVotedAtPrice(null);
              }}
              className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Change vote
            </button>
          </>
        )}
      </div>

      {userVote && priceChangeSinceVote != null && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-black/[0.03] px-2.5 py-1.5 dark:bg-white/[0.03]">
          {isCorrect ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Right
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
              <X className="h-3 w-3" /> Wrong
            </span>
          )}
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Price moved{" "}
            <span
              className={cn(
                "font-mono font-medium",
                priceChangeSinceVote >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {priceChangeSinceVote >= 0 ? "+" : ""}
              {formatCurrency(Math.abs(priceChangeSinceVote))}
              {priceChangePercent != null &&
                ` (${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(2)}%)`}
            </span>{" "}
            since your vote
          </span>
        </div>
      )}

      {userVote && priceChangeSinceVote == null && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          <Clock className="h-3 w-3" />
          Waiting for price movement...
        </div>
      )}
    </div>
  );
}
