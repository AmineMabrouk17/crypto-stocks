export type AssetKind = "crypto" | "stock";

export interface AssetRef {
  kind: AssetKind;
  /** Binance symbol for crypto (e.g. "BTCUSDT"), ticker for stocks (e.g. "QQQM") */
  symbol: string;
  /** CoinGecko coin id for crypto (e.g. "bitcoin"), same as symbol for stocks */
  id: string;
  name: string;
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AssetDescription {
  name: string;
  summary: string;
  extra?: Record<string, string | number | undefined>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoinListEntry {
  id: string;
  symbol: string;
  name: string;
}

export interface SearchResult {
  kind: AssetKind;
  id: string;
  symbol: string;
  name: string;
}

/** Live stats derived from the currently loaded chart window, for grounding the chat assistant. */
export interface MarketStats {
  sessionOpen: number | null;
  high: number | null;
  low: number | null;
  changePercent: number | null;
}

/** Official 24h (crypto) / daily (stocks, vs previous close) stats for the header badge. */
export interface DayStats {
  changePercent: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}
