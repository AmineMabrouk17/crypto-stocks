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

/** Which LLM backend powers the chat assistant. "gemini"/"openai"/"anthropic"/"groq" hit each provider's
 * official API; "custom" hits any OpenAI-compatible endpoint at a user-supplied base URL. */
export type LlmProvider = "gemini" | "openai" | "anthropic" | "groq" | "custom";

/** A user's Bring-Your-Own-Key chat settings. Persisted client-side only (localStorage) — never
 * sent to or stored by our server beyond the lifetime of a single proxied request. */
export interface LlmSettings {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  /** Only used when provider is "custom" — base URL of an OpenAI-compatible API. */
  customBaseUrl?: string;
}

/** A free built-in chat model available without needing a user API key. */
export interface FreeModel {
  id: string;
  label: string;
  provider: Extract<LlmProvider, "gemini" | "groq">;
  modelId: string;
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

/**
 * A user-defined target-price trigger. Evaluated only while its asset is the
 * one currently selected/streaming in the dashboard and this tab is open
 * (see usePriceAlerts) — there is no background worker.
 */
export interface PriceAlert {
  id: string;
  assetKind: AssetKind;
  assetSymbol: string;
  assetName: string;
  targetPrice: number;
  direction: "above" | "below";
  createdAt: number;
  triggeredAt: number | null;
  /** Last time the watcher evaluated this alert while its asset was open, or null if never. */
  lastCheckedAt: number | null;
  /**
   * When tracking stopped because the tab closed or the asset was switched
   * away; null while the alert is actively watched. Persisted so the panel can
   * say the alert is paused instead of implying it is still live.
   */
  pausedAt: number | null;
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string | null;
  publishedAt: string | null;
  /** Lightweight keyword-heuristic tag, not real sentiment analysis. */
  sentiment?: "positive" | "negative" | "neutral";
}

// Response-shape types for Rust-backed /api endpoints. Kept client-safe so
// SWR consumers can type their fetches without importing server code.

export interface FearGreedIndex {
  /** 0 (Extreme Fear) to 100 (Extreme Greed). */
  value: number;
  /** e.g. "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed". */
  classification: string;
  /** Unix seconds of the reading. */
  timestamp: number;
  /** Seconds until the next daily update. */
  timeUntilUpdate: number;
}

export type CrowdOddsHorizon = "4h" | "1D" | "1W";

/** Normalized Polymarket market record with decoded outcome arrays. */
export interface PolymarketMarket {
  id: string;
  slug: string;
  question: string;
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
  startDate: string;
  endDate: string;
  active: boolean;
  closed: boolean;
}

export interface CrowdOddsSnapshot {
  market: PolymarketMarket | null;
  upProbability: number;
  downProbability: number;
  endTime: string;
  availableHorizons: CrowdOddsHorizon[];
}
