export type ChartRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "YTD" | "ALL";

export const CHART_RANGES: ChartRange[] = ["1D", "1W", "1M", "6M", "1Y", "YTD", "ALL"];

export function isChartRange(value: string | null | undefined): value is ChartRange {
  return !!value && (CHART_RANGES as string[]).includes(value);
}

export interface BinanceRangeConfig {
  interval: string;
  limit: number;
}

/** Binance kline interval + limit for each range. Also used as the live WS subscription interval. */
export function binanceRangeConfig(range: ChartRange): BinanceRangeConfig {
  switch (range) {
    case "1D":
      return { interval: "5m", limit: 288 }; // 24h
    case "1W":
      return { interval: "1h", limit: 168 }; // 7d
    case "1M":
      return { interval: "4h", limit: 180 }; // 30d
    case "6M":
      return { interval: "1d", limit: 180 };
    case "1Y":
      return { interval: "1d", limit: 365 };
    case "YTD": {
      const start = Date.UTC(new Date().getUTCFullYear(), 0, 1);
      const days = Math.max(1, Math.ceil((Date.now() - start) / 86_400_000));
      return { interval: "1d", limit: days };
    }
    case "ALL":
      return { interval: "1M", limit: 200 }; // ~16y of monthly candles
  }
}

export interface YahooRangeConfig {
  range: string;
  interval: string;
}

/** Yahoo chart API `range`/`interval` query params for each app-level range. */
export function yahooRangeConfig(range: ChartRange): YahooRangeConfig {
  switch (range) {
    case "1D":
      return { range: "1d", interval: "5m" };
    case "1W":
      return { range: "5d", interval: "15m" };
    case "1M":
      return { range: "1mo", interval: "60m" };
    case "6M":
      return { range: "6mo", interval: "1d" };
    case "1Y":
      return { range: "1y", interval: "1d" };
    case "YTD":
      return { range: "ytd", interval: "1d" };
    case "ALL":
      return { range: "max", interval: "1mo" };
  }
}

/** Polling cadence for stock quotes — no need to hammer Yahoo when the candle resolution is daily. */
export function stockPollingIntervalMs(range: ChartRange): number {
  return range === "1D" ? 7_000 : 60_000;
}
