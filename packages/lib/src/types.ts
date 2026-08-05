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
 * one currently selected/streaming in the dashboard (see usePriceAlerts).
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
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string | null;
  publishedAt: string | null;
  /** Lightweight keyword-heuristic tag, not real sentiment analysis. */
  sentiment?: "positive" | "negative" | "neutral";
}
