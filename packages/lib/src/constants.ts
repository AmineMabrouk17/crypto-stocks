import type { AssetRef } from "./types";

// Swap to api.binance.us / stream.binance.us if deploying from a US IP (Binance.com geo-blocks the US).
export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443";

export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export const YAHOO_QUERY_BASE = "https://query1.finance.yahoo.com";
export const YAHOO_FC_BASE = "https://fc.yahoo.com";

export const GEMINI_MODEL = "gemini-flash-latest";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_WATCHLIST: AssetRef[] = [
  { kind: "crypto", symbol: "BTCUSDT", id: "bitcoin", name: "Bitcoin" },
  { kind: "crypto", symbol: "ETHUSDT", id: "ethereum", name: "Ethereum" },
  { kind: "stock", symbol: "QQQM", id: "QQQM", name: "Invesco NASDAQ 100 ETF" },
  { kind: "stock", symbol: "QQQ", id: "QQQ", name: "Invesco QQQ Trust" },
  { kind: "stock", symbol: "SPY", id: "SPY", name: "SPDR S&P 500 ETF" },
];
