"use client";

import type { AssetRef, Candle } from "@crypto-stocks/lib";
import { formatCurrency } from "@crypto-stocks/lib";
import { TrendingUp, TrendingDown, Check, X, Loader, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useVoterId } from "@/lib/useVoterId";
import { cn } from "@/lib/utils";

const RESOLVE_MS = 300_000;

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
  const [userDir, setUserDir] = useState<"up" | "down" | null>(null);
  const [votedAtPrice, setVotedAtPrice] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; actualPrice: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDirRef = useRef(userDir);
  const votedAtPriceRef = useRef(votedAtPrice);
  const currentPriceRef = useRef(currentPrice);
  useEffect(() => { userDirRef.current = userDir; }, [userDir]);
  useEffect(() => { votedAtPriceRef.current = votedAtPrice; }, [votedAtPrice]);
  useEffect(() => { currentPriceRef.current = currentPrice; }, [currentPrice]);

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

  const { data: counts, mutate: refreshCounts } = useSWR(
    voterId
      ? `/api/predictions/counts?symbol=${asset.symbol}&voter_id=${voterId}`
      : null,
    fetcher,
    { refreshInterval: 5_000 },
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const resolvePrediction = useCallback(() => {
    const dir = userDirRef.current;
    const basePrice = votedAtPriceRef.current;
    if (dir == null || basePrice == null) return;
    const actualPrice = currentPriceRef.current;
    if (actualPrice == null) return;

    fetch("/api/predictions/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_symbol: asset.symbol }),
    }).then(() => refreshCounts());

    const correct =
      (dir === "up" && actualPrice >= basePrice) ||
      (dir === "down" && actualPrice < basePrice);
    setResult({ correct, actualPrice });
  }, [asset.symbol, refreshCounts]);

  const handleVote = useCallback(
    async (dir: "up" | "down") => {
      if (!voterId) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      setResult(null);
      setUserDir(dir);
      setVotedAtPrice(currentPrice);
      setSubmitting(true);
      try {
        await fetch("/api/predictions/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_symbol: asset.symbol,
            direction: dir,
            voter_id: voterId,
          }),
        });
        refreshCounts();
        timerRef.current = setTimeout(resolvePrediction, RESOLVE_MS);
      } finally {
        setSubmitting(false);
      }
    },
    [asset.symbol, voterId, currentPrice, refreshCounts, resolvePrediction],
  );

  const priceDiff =
    result != null && votedAtPrice != null
      ? result.actualPrice - votedAtPrice
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
              Predicting Up
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
              Predicting Down
            </span>
          </span>
        </div>
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
              {votedAtPrice != null && (
                <span className="text-zinc-400 dark:text-zinc-500">
                  baseline was {formatCurrency(votedAtPrice)}
                </span>
              )}
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
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Predict again:</span>
              <button
                type="button"
                onClick={() => handleVote("up")}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
              >
                <TrendingUp className="h-3 w-3" /> Up
              </button>
              <button
                type="button"
                onClick={() => handleVote("down")}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
              >
                <TrendingDown className="h-3 w-3" /> Down
              </button>
            </div>
          </>
        ) : userDir ? (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Loader className="h-3 w-3 animate-spin" />
            Predicting {userDir === "up" ? "Up" : "Down"} — waiting for 5m close...
          </span>
        ) : (
          <>
            <span className="mr-1 text-xs text-zinc-400 dark:text-zinc-500">Where will it go?</span>
            <button
              type="button"
              onClick={() => handleVote("up")}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              <TrendingUp className="h-3 w-3" /> Up
            </button>
            <button
              type="button"
              onClick={() => handleVote("down")}
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
            >
              <TrendingDown className="h-3 w-3" /> Down
            </button>
          </>
        )}
      </div>
    </div>
  );
}
