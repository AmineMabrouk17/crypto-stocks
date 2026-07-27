"use client";

import {
  stockPollingIntervalMs,
  yahooRangeConfig,
  type Candle,
  type ChartRange,
  type MarketStats,
} from "@crypto-stocks/lib";
import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import type { PriceChartHandle } from "./PriceChart";

interface YahooQuoteResponse {
  price: number | null;
  currency: string | null;
  candles: Candle[];
}

function computeStats(data: YahooQuoteResponse | undefined): MarketStats {
  const candles = data?.candles;
  if (!candles?.length || data?.price == null) {
    return { sessionOpen: null, high: null, low: null, changePercent: null };
  }
  const sessionOpen = candles[0].open;
  const high = candles.reduce((h, c) => Math.max(h, c.high), -Infinity);
  const low = candles.reduce((l, c) => Math.min(l, c.low), Infinity);
  return {
    sessionOpen,
    high,
    low,
    changePercent: sessionOpen ? ((data.price - sessionOpen) / sessionOpen) * 100 : null,
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useStockPolling(symbol: string, range: ChartRange, chart: PriceChartHandle | null) {
  const { range: yahooRange, interval } = yahooRangeConfig(range);
  const { data, error } = useSWR<YahooQuoteResponse>(
    `/api/stocks/quote?symbol=${encodeURIComponent(symbol)}&range=${yahooRange}&interval=${interval}`,
    fetcher,
    { refreshInterval: stockPollingIntervalMs(range), revalidateOnFocus: true },
  );
  const seededRef = useRef<string | null>(null);
  const seedKey = `${symbol}:${range}`;

  useEffect(() => {
    seededRef.current = null;
  }, [seedKey]);

  useEffect(() => {
    if (!chart || !data?.candles?.length) return;
    if (seededRef.current !== seedKey) {
      chart.setData(data.candles);
      seededRef.current = seedKey;
    } else {
      const last = data.candles[data.candles.length - 1];
      if (last) chart.update(last);
    }
  }, [chart, data, seedKey]);

  const stats = useMemo(() => computeStats(data), [data]);

  return {
    price: data?.price ?? null,
    stats,
    status: error ? ("closed" as const) : data ? ("open" as const) : ("connecting" as const),
    seeding: !data && !error,
  };
}
