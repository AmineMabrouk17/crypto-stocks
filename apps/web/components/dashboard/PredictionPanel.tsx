"use client";

import type { AssetRef, Candle } from "@crypto-stocks/lib";
import { formatCurrency } from "@crypto-stocks/lib";
import { TrendingUp, TrendingDown, Check, X, Loader, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
}: {
  asset: AssetRef;
  candles: Candle[];
}) {
  const voterId = useVoterId();
  const [submitting, setSubmitting] = useState(false);
  const [userDir, setUserDir] = useState<"up" | "down" | null>(null);
  const [forecastAtVote, setForecastAtVote] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; actualPrice: number } | null>(null);
  const prevCandlesLenRef = useRef(0);
  const userDirRef = useRef(userDir);
  const forecastAtVoteRef = useRef(forecastAtVote);
  useEffect(() => { userDirRef.current = userDir; }, [userDir]);
  useEffect(() => { forecastAtVoteRef.current = forecastAtVote; }, [forecastAtVote]);

  const candleInterval = useMemo(() => {
    if (candles.length < 2) return 0;
    return candles[candles.length - 1].time - candles[candles.length - 2].time;
  }, [candles]);

  const intervalLabel =
    candleInterval >= 86400
      ? `${Math.round(candleInterval / 86400)}d`
      : candleInterval >= 3600
        ? `${Math.round(candleInterval / 3600)}h`
        : candleInterval >= 60
          ? `${Math.round(candleInterval / 60)}m`
          : "";

  const predictedPrice = useMemo(() => predictNextPrice(candles.map((c) => c.close)), [candles]);

  const { data: counts, mutate: refreshCounts } = useSWR(
    voterId
      ? `/api/predictions/counts?symbol=${asset.symbol}&voter_id=${voterId}`
      : null,
    fetcher,
    { refreshInterval: 5_000 },
  );

  useEffect(() => {
    const prevLen = prevCandlesLenRef.current;
    prevCandlesLenRef.current = candles.length;

    if (prevLen > 0 && candles.length === prevLen + 1 && candles.length >= 2) {
      const completedCandle = candles[candles.length - 2];
      const actualClose = completedCandle.close;

      fetch("/api/predictions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_symbol: asset.symbol, actual_close: actualClose }),
      }).then(() => refreshCounts());

      const dir = userDirRef.current;
      const forecast = forecastAtVoteRef.current;
      if (dir && forecast != null) {
        const correct =
          (dir === "up" && actualClose >= forecast) ||
          (dir === "down" && actualClose < forecast);
        setResult({ correct, actualPrice: actualClose });
      }
    }
  }, [candles, asset.symbol, refreshCounts]);

  const handleVote = useCallback(
    async (dir: "up" | "down") => {
      if (!voterId) return;
      setResult(null);
      setUserDir(dir);
      setForecastAtVote(predictedPrice);
      setSubmitting(true);
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
    [asset.symbol, voterId, predictedPrice, refreshCounts],
  );

  if (predictedPrice <= 0) return null;

  const priceDiff =
    result != null && forecastAtVote != null
      ? result.actualPrice - forecastAtVote
      : null;

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Price Prediction
          </span>
          <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
            next {intervalLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="group relative">
            <span className="flex items-center gap-1 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <motion.span
                key={counts?.up ?? 0}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 0.25 }}
              >
                {counts?.up ?? 0}
              </motion.span>
              {counts?.userVote?.direction === "up" && (
                <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                  You
                </span>
              )}
            </span>
            <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
              Predicting Above forecast
            </span>
          </span>
          <span className="group relative">
            <span className="flex items-center gap-1 font-mono tabular-nums text-red-600 dark:text-red-400">
              <TrendingDown className="h-3 w-3" />
              <motion.span
                key={counts?.down ?? 0}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 0.25 }}
              >
                {counts?.down ?? 0}
              </motion.span>
              {counts?.userVote?.direction === "down" && (
                <span className="rounded bg-red-500/15 px-1 text-[9px] font-semibold text-red-600 dark:text-red-400">
                  You
                </span>
              )}
            </span>
            <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
              Predicting Below forecast
            </span>
          </span>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Forecast:</span>
        <span className="group relative">
          <span className="font-mono text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {formatCurrency(predictedPrice)}
          </span>
          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">
            Predicted next close
          </span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {result ? (
          <>
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span
                className={cn(
                  "flex items-center gap-1 font-semibold",
                  result.correct
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {result.correct ? (
                  <><Check className="h-3.5 w-3.5" /> Right</>
                ) : (
                  <><X className="h-3.5 w-3.5" /> Wrong</>
                )}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">
                forecast was {formatCurrency(forecastAtVote!)}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">
                <ArrowUpRight className="mr-0.5 inline h-3 w-3" />
                closed {formatCurrency(result.actualPrice)}
              </span>
              {priceDiff != null && (
                <span
                  className={cn(
                    "font-mono",
                    priceDiff >= 0
                      ? "text-emerald-500 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400",
                  )}
                >
                  {priceDiff >= 0 ? "+" : ""}
                  {formatCurrency(priceDiff)}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex w-full items-center gap-1.5">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Next round:</span>
              <button
                type="button"
                onClick={() => handleVote("up")}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
              >
                <TrendingUp className="h-3 w-3" /> Above {formatCurrency(predictedPrice)}
              </button>
              <button
                type="button"
                onClick={() => handleVote("down")}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
              >
                <TrendingDown className="h-3 w-3" /> Below {formatCurrency(predictedPrice)}
              </button>
            </div>
          </>
        ) : userDir ? (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Loader className="h-3 w-3 animate-spin" />
            Predicting {userDir === "up" ? "Above" : "Below"} — waiting for next {intervalLabel} close...
          </span>
        ) : (
          <>
            <span className="mr-1 text-xs text-zinc-400 dark:text-zinc-500">
              Price will close:
            </span>
            <button
              type="button"
              onClick={() => handleVote("up")}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              <TrendingUp className="h-3 w-3" /> Above {formatCurrency(predictedPrice)}
            </button>
            <button
              type="button"
              onClick={() => handleVote("down")}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
            >
              <TrendingDown className="h-3 w-3" /> Below {formatCurrency(predictedPrice)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
