import { COINGECKO_BASE } from "./constants";
import type { AssetDescription, CoinListEntry } from "./types";

export async function fetchCoinList(): Promise<CoinListEntry[]> {
  const res = await fetch(`${COINGECKO_BASE}/coins/list`);
  if (!res.ok) throw new Error(`CoinGecko coin list request failed: ${res.status}`);
  return (await res.json()) as CoinListEntry[];
}

interface CoinGeckoCoinResponse {
  name: string;
  description: { en?: string };
  market_cap_rank?: number;
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export async function fetchCoinDescription(coinId: string): Promise<AssetDescription> {
  const url = `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko coin request failed: ${res.status}`);
  const data = (await res.json()) as CoinGeckoCoinResponse;

  const fullText = data.description?.en ? stripHtml(data.description.en) : "";
  const summary = fullText ? fullText.split("\n\n")[0] : `${data.name} is a cryptocurrency.`;

  return {
    name: data.name,
    summary,
    extra: {
      marketCapRank: data.market_cap_rank,
      priceUsd: data.market_data?.current_price?.usd,
      marketCapUsd: data.market_data?.market_cap?.usd,
    },
  };
}
