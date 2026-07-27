"use client";

import { fetchTicker24hr, type DayStats } from "@crypto-stocks/lib";
import useSWR from "swr";

const EMPTY_DAY_STATS: DayStats = { changePercent: null, high: null, low: null, volume: null };
const REFRESH_MS = 30_000;

export function useCrypto24hStats(symbol: string): DayStats {
  const { data } = useSWR<DayStats>(
    symbol ? (["crypto24hStats", symbol] as const) : null,
    ([, sym]: readonly [string, string]) => fetchTicker24hr(sym),
    { refreshInterval: REFRESH_MS, revalidateOnFocus: true },
  );
  return data ?? EMPTY_DAY_STATS;
}
