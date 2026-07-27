"use client";

import type { DayStats } from "@crypto-stocks/lib";
import useSWR from "swr";

const EMPTY_DAY_STATS: DayStats = { changePercent: null, high: null, low: null, volume: null };

interface QuoteResponse {
  dayStats: DayStats;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Always requests range=1d/interval=1m, independent of the chart's selected range — Yahoo only
 * populates `previousClose` for 1d requests. At other ranges it falls back to `chartPreviousClose`,
 * the price from the *start of that window*, which reads as a wildly wrong "today" change.
 */
export function useStockDayStats(symbol: string): DayStats {
  const { data } = useSWR<QuoteResponse>(
    `/api/stocks/quote?symbol=${encodeURIComponent(symbol)}&range=1d&interval=1m`,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );
  return data?.dayStats ?? EMPTY_DAY_STATS;
}
