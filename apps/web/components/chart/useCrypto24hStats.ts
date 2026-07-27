"use client";

import { fetchTicker24hr, type DayStats } from "@crypto-stocks/lib";
import { useEffect, useState } from "react";

const EMPTY_DAY_STATS: DayStats = { changePercent: null, high: null, low: null, volume: null };
const REFRESH_MS = 30_000;

export function useCrypto24hStats(symbol: string): DayStats {
  const [stats, setStats] = useState<DayStats>(EMPTY_DAY_STATS);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await fetchTicker24hr(symbol);
        if (!cancelled) setStats(next);
      } catch {
        // transient failure — keep showing the last known stats
      }
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  return stats;
}
