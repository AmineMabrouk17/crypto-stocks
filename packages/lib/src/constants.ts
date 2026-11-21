import type { AssetRef, FreeModel } from "./types";

// Swap to api.binance.us / stream.binance.us if deploying from a US IP (Binance.com geo-blocks the US).
export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443";

export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export const FREE_MODELS: FreeModel[] = [
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "gemini", modelId: "gemini-1.5-flash" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini", modelId: "gemini-2.0-flash" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "gemini", modelId: "gemini-1.5-pro" },
  { id: "groq-gpt-oss-120b", label: "Groq GPT-OSS 120B", provider: "groq", modelId: "openai/gpt-oss-120b" },
  { id: "groq-gpt-oss-20b", label: "Groq GPT-OSS 20B", provider: "groq", modelId: "openai/gpt-oss-20b" },
  { id: "groq-llama-3.3-70b", label: "Groq Llama 3.3 70B", provider: "groq", modelId: "llama-3.3-70b-versatile" },
  { id: "groq-llama-3.1-8b", label: "Groq Llama 3.1 8B", provider: "groq", modelId: "llama-3.1-8b-instant" },
];

export const DEFAULT_WATCHLIST: AssetRef[] = [
  { kind: "crypto", symbol: "BTCUSDT", id: "bitcoin", name: "Bitcoin" },
  { kind: "crypto", symbol: "ETHUSDT", id: "ethereum", name: "Ethereum" },
  { kind: "stock", symbol: "QQQM", id: "QQQM", name: "Invesco NASDAQ 100 ETF" },
  { kind: "stock", symbol: "QQQ", id: "QQQ", name: "Invesco QQQ Trust" },
  { kind: "stock", symbol: "SPY", id: "SPY", name: "SPDR S&P 500 ETF" },
];
