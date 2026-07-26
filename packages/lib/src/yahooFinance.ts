import { YAHOO_FC_BASE, YAHOO_QUERY_BASE } from "./constants";
import type { AssetDescription, Candle, SearchResult } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface YahooSession {
  cookie: string;
  crumb: string;
  expiresAt: number;
}

let cachedSession: YahooSession | null = null;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1h

async function getYahooSession(): Promise<YahooSession> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession;

  const fcRes = await fetch(YAHOO_FC_BASE, { headers: { "User-Agent": USER_AGENT } });
  const setCookie = fcRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] ?? "";

  const crumbRes = await fetch(`${YAHOO_QUERY_BASE}/v1/test/getcrumb`, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();

  cachedSession = { cookie, crumb, expiresAt: Date.now() + SESSION_TTL_MS };
  return cachedSession;
}

export interface YahooQuote {
  price: number | null;
  currency: string | null;
  candles: Candle[];
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const url = `${YAHOO_QUERY_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Yahoo chart request failed: ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo chart response missing result");

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = timestamps
    .map((t, i) => ({
      time: t,
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
    }))
    .filter(
      (c): c is Candle =>
        c.open != null && c.high != null && c.low != null && c.close != null,
    );

  return {
    price: result.meta?.regularMarketPrice ?? null,
    currency: result.meta?.currency ?? null,
    candles,
  };
}

export async function searchYahoo(query: string): Promise<SearchResult[]> {
  const session = await getYahooSession();
  const url = `${YAHOO_QUERY_BASE}/v1/finance/search?q=${encodeURIComponent(query)}&crumb=${encodeURIComponent(session.crumb)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Cookie: session.cookie },
  });
  if (!res.ok) throw new Error(`Yahoo search request failed: ${res.status}`);
  const data = await res.json();
  const quotes: any[] = data?.quotes ?? [];
  return quotes
    .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
    .map((q) => ({
      kind: "stock" as const,
      id: q.symbol,
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
    }));
}

export async function fetchYahooDescription(symbol: string): Promise<AssetDescription> {
  const session = await getYahooSession();
  const url = `${YAHOO_QUERY_BASE}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,summaryProfile,fundProfile&crumb=${encodeURIComponent(session.crumb)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Cookie: session.cookie },
  });
  if (!res.ok) throw new Error(`Yahoo quoteSummary request failed: ${res.status}`);
  const data = await res.json();
  const result = data?.quoteSummary?.result?.[0] ?? {};

  const longSummary: string | undefined =
    result.assetProfile?.longBusinessSummary ?? result.summaryProfile?.longBusinessSummary;
  const fundCategory: string | undefined = result.fundProfile?.categoryName;

  const summary =
    longSummary ??
    (fundCategory
      ? `${symbol} is an exchange-traded fund tracking the ${fundCategory} category.`
      : `${symbol} is a publicly traded equity or fund. No detailed profile is available from this data source.`);

  return { name: symbol, summary };
}
