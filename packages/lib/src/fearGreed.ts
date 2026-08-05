import { ALTERNATIVE_ME_FNG_BASE } from "./constants";

/** A single daily reading of the Alternative.me Fear & Greed index. */
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

interface FearGreedApiRecord {
  value?: string | number;
  value_classification?: string;
  timestamp?: string | number;
  time_until_update?: string | number;
}

function toNumber(value: string | number | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses the Alternative.me /fng/ JSON envelope. The value arrives as a string
 * (e.g. "27") and is coerced to a number here.
 */
export function parseFearGreedIndex(json: unknown): FearGreedIndex {
  const record = (
    json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)
      ? (json as { data: FearGreedApiRecord[] }).data[0]
      : null
  );

  if (!record) {
    throw new Error("Fear & Greed response missing data");
  }

  const value = toNumber(record.value);
  if (value == null) throw new Error("Fear & Greed response missing value");

  return {
    value,
    classification: record.value_classification ?? "Unknown",
    timestamp: toNumber(record.timestamp) ?? 0,
    timeUntilUpdate: toNumber(record.time_until_update) ?? 0,
  };
}

/** Fetches the latest daily Fear & Greed reading — no API key required. */
export async function fetchFearGreedIndex(): Promise<FearGreedIndex> {
  const res = await fetch(`${ALTERNATIVE_ME_FNG_BASE}/?limit=1`);
  if (!res.ok) throw new Error(`Fear & Greed request failed: ${res.status}`);
  return parseFearGreedIndex(await res.json());
}
