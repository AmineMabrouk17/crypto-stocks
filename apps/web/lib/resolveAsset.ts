import {
  fetchCoinDescription,
  fetchCoinList,
  fetchYahooDescription,
  searchYahoo,
  type AssetRef,
} from "@crypto-stocks/lib";

export interface ResolvedAsset {
  asset: AssetRef;
  summary: string;
}

// CoinGecko's /coins/list has many low-quality/scam tokens reusing well-known symbols
// (e.g. dozens of tokens using "btc"), so a naive symbol match on that list is unreliable.
// Pin the CoinGecko id for majors directly; only fall back to the list search below this.
const KNOWN_COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  TON: "the-open-network",
  DOT: "polkadot",
  MATIC: "matic-network",
  LTC: "litecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  SHIB: "shiba-inu",
  UNI: "uniswap",
  ATOM: "cosmos",
  XLM: "stellar",
  BCH: "bitcoin-cash",
  NEAR: "near",
};

/**
 * Resolves a route param like "BTCUSDT" or "AAPL" into a full AssetRef + description,
 * server-side. Crypto pairs in this app always use the Binance USDT-quoted symbol
 * convention (see AssetSearchBar's toAssetRef), so a USDT suffix reliably signals crypto.
 *
 * `idHint` (the CoinGecko id) should be passed whenever it's already known — e.g. the
 * in-app "open full page" link includes it — since it's the only fully reliable source.
 * Without a hint, this falls back to a static map of majors, then a best-effort list
 * search that can occasionally pick the wrong coin for an ambiguous ticker.
 */
export async function resolveAsset(rawSymbol: string, idHint?: string): Promise<ResolvedAsset> {
  const symbol = rawSymbol.toUpperCase();

  if (symbol.endsWith("USDT")) {
    const base = symbol.slice(0, -4);
    let id = idHint || KNOWN_COIN_IDS[base] || base.toLowerCase();
    let name = base;

    if (!idHint && !KNOWN_COIN_IDS[base]) {
      try {
        const list = await fetchCoinList();
        const match = list.find((c) => c.symbol.toLowerCase() === base.toLowerCase());
        if (match) {
          id = match.id;
          name = match.name;
        }
      } catch {
        // fall back to the base symbol as id/name
      }
    }

    let summary = `${name} is a cryptocurrency.`;
    try {
      const desc = await fetchCoinDescription(id);
      summary = desc.summary;
      name = desc.name;
    } catch {
      // description is best-effort
    }

    return { asset: { kind: "crypto", symbol, id, name }, summary };
  }

  let name = symbol;
  try {
    const results = await searchYahoo(symbol);
    const match = results.find((r) => r.symbol.toUpperCase() === symbol);
    if (match) name = match.name;
  } catch {
    // fall back to the symbol as name
  }

  let summary = `${name} is a publicly traded stock or ETF.`;
  try {
    const desc = await fetchYahooDescription(symbol);
    summary = desc.summary;
  } catch {
    // description is best-effort
  }

  return { asset: { kind: "stock", symbol, id: symbol, name }, summary };
}
