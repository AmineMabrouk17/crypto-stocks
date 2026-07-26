import { fetchCoinList, type CoinListEntry } from "@crypto-stocks/lib";

let cachedList: CoinListEntry[] | null = null;
let inFlight: Promise<CoinListEntry[]> | null = null;

const STORAGE_KEY = "crypto-stocks:coin-list";
const STORAGE_TS_KEY = "crypto-stocks:coin-list:ts";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function getCoinList(): Promise<CoinListEntry[]> {
  if (cachedList) return cachedList;

  if (typeof window !== "undefined") {
    const ts = Number(window.sessionStorage.getItem(STORAGE_TS_KEY) ?? 0);
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw && Date.now() - ts < TTL_MS) {
      try {
        cachedList = JSON.parse(raw) as CoinListEntry[];
        return cachedList;
      } catch {
        // fall through to refetch
      }
    }
  }

  if (!inFlight) {
    inFlight = fetchCoinList().then((list) => {
      cachedList = list;
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          window.sessionStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
        } catch {
          // sessionStorage may be full/unavailable; cached in-memory copy still works
        }
      }
      return list;
    });
  }
  return inFlight;
}

export function filterCoinList(list: CoinListEntry[], query: string, limit = 8): CoinListEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const symbolMatches = list.filter((c) => c.symbol.toLowerCase() === q);
  const startsWith = list.filter(
    (c) => c.symbol.toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q),
  );
  const contains = list.filter((c) => c.name.toLowerCase().includes(q));
  const merged = [...symbolMatches, ...startsWith, ...contains];
  const seen = new Set<string>();
  const deduped = merged.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  return deduped.slice(0, limit);
}
