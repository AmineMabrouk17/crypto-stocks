import type { AssetRef, FreeModel } from "./types";

// Swap to api.binance.us / stream.binance.us if deploying from a US IP (Binance.com geo-blocks the US).
export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443";

export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export const YAHOO_QUERY_BASE = "https://query1.finance.yahoo.com";
export const YAHOO_FC_BASE = "https://fc.yahoo.com";

export const ALTERNATIVE_ME_FNG_BASE = "https://api.alternative.me/fng";

export const GEMINI_MODEL = "gemini-flash-latest";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export const FREE_MODELS: FreeModel[] = [
  { id: "gemini-flash", label: "Gemini 2.0 Flash", provider: "gemini", modelId: GEMINI_MODEL },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", modelId: "gemini-2.5-flash-latest" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", modelId: "gemini-2.5-pro-latest" },
  { id: "groq-gpt-oss-120b", label: "Groq GPT-OSS 120B", provider: "groq", modelId: "openai/gpt-oss-120b" },
  { id: "groq-gpt-oss-20b", label: "Groq GPT-OSS 20B", provider: "groq", modelId: "openai/gpt-oss-20b" },
  { id: "groq-llama-3.3-70b", label: "Groq Llama 3.3 70B", provider: "groq", modelId: "llama-3.3-70b-versatile" },
  { id: "groq-llama-3.1-8b", label: "Groq Llama 3.1 8B", provider: "groq", modelId: "llama-3.1-8b-instant" },
];

export const GOOGLE_NEWS_RSS_BASE = "https://news.google.com/rss/search";

export const DEFAULT_WATCHLIST: AssetRef[] = [
  { kind: "crypto", symbol: "BTCUSDT", id: "bitcoin", name: "Bitcoin" },
  { kind: "crypto", symbol: "ETHUSDT", id: "ethereum", name: "Ethereum" },
  { kind: "stock", symbol: "QQQM", id: "QQQM", name: "Invesco NASDAQ 100 ETF" },
  { kind: "stock", symbol: "QQQ", id: "QQQ", name: "Invesco QQQ Trust" },
  { kind: "stock", symbol: "SPY", id: "SPY", name: "SPDR S&P 500 ETF" },
];
