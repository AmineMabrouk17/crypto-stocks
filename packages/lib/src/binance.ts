import { BINANCE_REST_BASE, BINANCE_WS_BASE } from "./constants";
import type { Candle, DayStats } from "./types";

type RawKline = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  ...unknown[],
];

export async function fetchKlines(
  symbol: string,
  interval = "1m",
  limit = 500,
): Promise<Candle[]> {
  const url = `${BINANCE_REST_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines request failed: ${res.status}`);
  const raw = (await res.json()) as RawKline[];
  return raw.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
  }));
}

export async function fetchTicker24hr(symbol: string): Promise<DayStats> {
  const url = `${BINANCE_REST_BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance 24hr ticker request failed: ${res.status}`);
  const data = await res.json();
  return {
    changePercent: data.priceChangePercent != null ? Number(data.priceChangePercent) : null,
    high: data.highPrice != null ? Number(data.highPrice) : null,
    low: data.lowPrice != null ? Number(data.lowPrice) : null,
    volume: data.volume != null ? Number(data.volume) : null,
  };
}

export function klineStreamUrl(symbol: string, interval = "1m"): string {
  return `${BINANCE_WS_BASE}/ws/${symbol.toLowerCase()}@kline_${interval}`;
}

export function miniTickerStreamUrl(symbols: string[]): string {
  const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join("/");
  return `${BINANCE_WS_BASE}/stream?streams=${streams}`;
}

export interface BinanceKlineMessage {
  e: "kline";
  s: string;
  k: {
    t: number; // kline start time
    o: string;
    h: string;
    l: string;
    c: string;
    x: boolean; // is this kline closed?
  };
}

export function parseKlineMessage(raw: string): BinanceKlineMessage | null {
  const msg = JSON.parse(raw);
  if (msg?.e === "kline") return msg as BinanceKlineMessage;
  return null;
}

export interface BinanceMiniTicker {
  e: "24hrMiniTicker";
  s: string; // symbol
  c: string; // close price
}

export function parseMiniTickerMessage(raw: string): BinanceMiniTicker | null {
  const msg = JSON.parse(raw);
  const payload = msg?.data ?? msg;
  if (payload?.e === "24hrMiniTicker") return payload as BinanceMiniTicker;
  return null;
}
