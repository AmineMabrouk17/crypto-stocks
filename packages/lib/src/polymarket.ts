import { POLYMARKET_CLOB_BASE, POLYMARKET_GAMMA_BASE } from "./constants";

/**
 * Crowd Odds (Polymarket) client — read-only.
 *
 * Polymarket runs binary "Up or Down" crypto markets across several cadences
 * (5m / 15m / 1h / 4h / daily). This module discovers the active market for a
 * given asset + Horizon via the Gamma API and reads the live Up probability
 * from the CLOB midpoint, falling back to the (staler) Gamma `outcomePrices`.
 *
 * Gamma ships `outcomes`, `outcomePrices` and `clobTokenIds` as JSON strings
 * inside JSON (double-encoded) — the parsing here decodes them.
 */

export type CrowdOddsHorizon = "4h" | "1D" | "1W";

/** Cadence order is also the tab order in the UI. */
export const CROWD_ODDS_HORIZONS: CrowdOddsHorizon[] = ["4h", "1D", "1W"];

/** Normalized Polymarket market record with the double-encoded arrays decoded. */
export interface PolymarketMarket {
  id: string;
  slug: string;
  question: string;
  /** e.g. ["Up", "Down"] */
  outcomes: string[];
  /** Share prices in [0, 1], index-aligned with `outcomes`. */
  outcomePrices: number[];
  /** One token id per outcome (YES/Up first). */
  clobTokenIds: string[];
  startDate: string;
  endDate: string;
  active: boolean;
  closed: boolean;
}

/** A single crowd-odds reading for an asset + Horizon. */
export interface CrowdOddsSnapshot {
  /** The active market at the requested Horizon, or null when there is none. */
  market: PolymarketMarket | null;
  /** Probability (0–1) the asset closes Up. */
  upProbability: number;
  /** Probability (0–1) the asset closes Down. */
  downProbability: number;
  /** ISO end time of the market (when the bet resolves). */
  endTime: string;
  /** Horizons with an active market right now — drives the toggle tabs. */
  availableHorizons: CrowdOddsHorizon[];
}

/** Curated discovery spec for the majors that carry up/down markets. */
export interface PolymarketAssetSpec {
  symbol: string;
  /** Short prefix used by the `{short}-updown-4h-…` slug family. */
  short: string;
  /** Full name used by the `{name}-up-or-down-on-…` daily slug family. */
  name: string;
  /** Query phrase for the generic public-search fallback. */
  search: string;
}

export const POLYMARKET_CURATED: Record<string, PolymarketAssetSpec> = {
  BTCUSDT: { symbol: "BTCUSDT", short: "btc", name: "bitcoin", search: "bitcoin up or down" },
  ETHUSDT: { symbol: "ETHUSDT", short: "eth", name: "ethereum", search: "ethereum up or down" },
  SOLUSDT: { symbol: "SOLUSDT", short: "sol", name: "solana", search: "solana up or down" },
  XRPUSDT: { symbol: "XRPUSDT", short: "xrp", name: "xrp", search: "xrp up or down" },
  DOGEUSDT: { symbol: "DOGEUSDT", short: "doge", name: "dogecoin", search: "dogecoin up or down" },
  BNBUSDT: { symbol: "BNBUSDT", short: "bnb", name: "bnb", search: "bnb up or down" },
};

/** Per-horizon active market map produced by a single discovery pass. */
export type PerHorizonMarkets = Record<CrowdOddsHorizon, PolymarketMarket | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Gamma encodes arrays as JSON strings inside JSON — decode both shapes. */
function decodeArray(value: unknown): unknown[] {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parses one Gamma market record into a normalized `PolymarketMarket`,
 * decoding the double-encoded `outcomes` / `outcomePrices` / `clobTokenIds`.
 */
export function parsePolymarketMarket(json: unknown): PolymarketMarket {
  if (!isRecord(json)) throw new Error("Polymarket market record missing");
  const slug = typeof json.slug === "string" ? json.slug : "";
  if (!slug) throw new Error("Polymarket market record missing slug");

  const outcomes = decodeArray(json.outcomes).map(String);
  if (outcomes.length === 0) throw new Error("Polymarket market record missing outcomes");

  const outcomePrices = decodeArray(json.outcomePrices)
    .map(toNumber)
    .filter((n): n is number => n != null);
  if (outcomePrices.length < outcomes.length) {
    throw new Error("Polymarket market record missing outcome prices");
  }

  const clobTokenIds = decodeArray(json.clobTokenIds).map(String);
  if (clobTokenIds.length < 2) throw new Error("Polymarket market record missing clob token ids");

  return {
    id: typeof json.id === "string" ? json.id : "",
    slug,
    question: typeof json.question === "string" ? json.question : slug,
    outcomes,
    outcomePrices,
    clobTokenIds,
    startDate: typeof json.startDate === "string" ? json.startDate : "",
    endDate: typeof json.endDate === "string" ? json.endDate : "",
    active: json.active === true,
    closed: json.closed === true,
  };
}

const HORIZON_PATTERNS: Array<[CrowdOddsHorizon, RegExp]> = [
  ["4h", /updown-4h-/i],
  ["1D", /-up-or-down-on-/i],
  ["1W", /up-or-down-(this-)?week/i],
];

/** Maps a Polymarket up/down market slug to its Horizon, or null if unrecognized. */
export function horizonForSlug(slug: string): CrowdOddsHorizon | null {
  for (const [horizon, pattern] of HORIZON_PATTERNS) {
    if (pattern.test(slug)) return horizon;
  }
  return null;
}

function isOpen(market: PolymarketMarket): boolean {
  return market.active && !market.closed;
}

/** Among open markets, picks the one with the nearest end time. */
export function selectNearestMarket(markets: PolymarketMarket[]): PolymarketMarket | null {
  const open = markets.filter(isOpen);
  if (open.length === 0) return null;
  return [...open].sort(
    (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime(),
  )[0] ?? null;
}

/** "Up" is the first outcome on Polymarket up/down markets ("Yes" elsewhere). */
export function upOutcomeIndex(outcomes: string[]): number {
  const index = outcomes.findIndex(
    (o) => o.trim().toLowerCase() === "up" || o.trim().toLowerCase() === "yes",
  );
  return index >= 0 ? index : 0;
}

/** Parses the CLOB `/midpoint` body, e.g. `{ "mid": "0.705" }`. */
export function parseMidpoint(json: unknown): number | null {
  if (!isRecord(json)) return null;
  const value = toNumber(json.mid);
  if (value == null || value < 0 || value > 1) return null;
  return value;
}

/** UTC offset in hours for the US Eastern timezone at the given instant. */
function etOffsetHours(date: Date): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part ?? "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) + Number(match[3] ?? "0") / 60);
}

function etDateParts(date: Date): { month: string; day: string; year: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { month: get("month").toLowerCase(), day: get("day"), year: get("year") };
}

const HOUR_4 = 4 * 3600;
const DAY_MS = 86_400_000;

/** Candidate `{short}-updown-4h-{unix}` slugs around the current ET 4h window. */
export function fourHourSlugs(spec: PolymarketAssetSpec, now: Date): string[] {
  const offset = etOffsetHours(now);
  const nowEt = now.getTime() / 1000 + offset * 3600;
  const currentStartEt = Math.floor(nowEt / HOUR_4) * HOUR_4;
  const slugs: string[] = [];
  for (let k = 0; k < 3; k++) {
    const startUtc = currentStartEt + k * HOUR_4 - offset * 3600;
    slugs.push(`${spec.short}-updown-4h-${Math.round(startUtc)}`);
  }
  return slugs;
}

/** Candidate `{name}-up-or-down-on-{month}-{day}-{year}` daily slugs for the next few ET dates. */
export function dailySlugs(spec: PolymarketAssetSpec, now: Date): string[] {
  const slugs: string[] = [];
  for (let day = 0; day < 3; day++) {
    const { month, day: dayNum, year } = etDateParts(new Date(now.getTime() + day * DAY_MS));
    slugs.push(`${spec.name}-up-or-down-on-${month}-${dayNum}-${year}`);
  }
  return slugs;
}

/** Weekly up/down markets are rare — one canonical slug shape is enough to probe. */
export function weeklySlugs(spec: PolymarketAssetSpec): string[] {
  return [`${spec.name}-up-or-down-this-week`];
}

export function candidateSlugs(spec: PolymarketAssetSpec, horizon: CrowdOddsHorizon, now: Date): string[] {
  if (horizon === "4h") return fourHourSlugs(spec, now);
  if (horizon === "1D") return dailySlugs(spec, now);
  return weeklySlugs(spec);
}

function makeFallbackSpec(symbol: string): PolymarketAssetSpec {
  const base = symbol.replace(/^(.*?)(?:USDT|USDC|BUSD)$/i, "$1") || symbol;
  return {
    symbol,
    short: base.toLowerCase(),
    name: base.toLowerCase(),
    search: `${base} up or down`,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": "crypto-stocks/1.0" } });
  if (!res.ok) throw new Error(`Polymarket request failed: ${res.status}`);
  return res.json();
}

async function fetchMarketsBySlug(slug: string): Promise<PolymarketMarket[]> {
  const json = await fetchJson(
    `${POLYMARKET_GAMMA_BASE}/markets?slug=${encodeURIComponent(slug)}`,
  );
  if (!Array.isArray(json)) return [];
  return json
    .map((raw) => {
      try {
        return parsePolymarketMarket(raw);
      } catch {
        return null;
      }
    })
    .filter((m): m is PolymarketMarket => m != null);
}

async function searchUpDownMarkets(query: string): Promise<PolymarketMarket[]> {
  const json = await fetchJson(
    `${POLYMARKET_GAMMA_BASE}/public-search?q=${encodeURIComponent(query)}&limit_per_type=10`,
  );
  if (!isRecord(json)) return [];
  const events = Array.isArray(json.events) ? json.events : [];
  const markets: PolymarketMarket[] = [];
  for (const event of events) {
    if (!isRecord(event)) continue;
    const nested = Array.isArray(event.markets) ? event.markets : [];
    for (const raw of nested) {
      try {
        const market = parsePolymarketMarket(raw);
        if (isOpen(market)) markets.push(market);
      } catch {
        // skip malformed records
      }
    }
  }
  return markets;
}

async function discoverCurated(
  spec: PolymarketAssetSpec,
  horizon: CrowdOddsHorizon,
  now: Date,
): Promise<PolymarketMarket | null> {
  const found: PolymarketMarket[] = [];
  for (const slug of candidateSlugs(spec, horizon, now)) {
    try {
      found.push(...(await fetchMarketsBySlug(slug)));
    } catch {
      // one bad slug shouldn't abort the sweep
    }
  }
  return selectNearestMarket(found);
}

function classifyByHorizon(
  markets: PolymarketMarket[],
  horizon: CrowdOddsHorizon,
): PolymarketMarket | null {
  return selectNearestMarket(markets.filter((m) => horizonForSlug(m.slug) === horizon));
}

async function discoverGeneric(
  spec: PolymarketAssetSpec,
): Promise<PolymarketMarket[]> {
  try {
    return await searchUpDownMarkets(spec.search);
  } catch {
    return [];
  }
}

function fillFromGeneric(
  result: PerHorizonMarkets,
  generic: PolymarketMarket[],
): void {
  for (const horizon of CROWD_ODDS_HORIZONS) {
    if (result[horizon] == null) result[horizon] = classifyByHorizon(generic, horizon);
  }
}

/**
 * Discovers the active up/down market for every Horizon of an asset in a single
 * pass. Curated majors use deterministic slug construction per cadence; the
 * generic search fallback covers the long tail (and may legitimately find
 * nothing, which is what powers the widget's empty state).
 */
export async function discoverUpDownMarkets(
  symbol: string,
  now = new Date(),
): Promise<PerHorizonMarkets> {
  const spec = POLYMARKET_CURATED[symbol] ?? makeFallbackSpec(symbol);
  const result: PerHorizonMarkets = { "4h": null, "1D": null, "1W": null };

  if (spec.symbol in POLYMARKET_CURATED) {
    for (const horizon of CROWD_ODDS_HORIZONS) {
      result[horizon] = await discoverCurated(spec, horizon, now);
    }
    // If the curated slug scheme missed any cadence (slug drift, network
    // blip), rescue just that horizon from one generic search instead of
    // leaving it out of availableHorizons.
    if (CROWD_ODDS_HORIZONS.some((h) => result[h] == null)) {
      fillFromGeneric(result, await discoverGeneric(spec));
    }
    return result;
  }

  fillFromGeneric(result, await discoverGeneric(spec));
  return result;
}

async function fetchUpMidpoint(market: PolymarketMarket): Promise<number | null> {
  const tokenId = market.clobTokenIds[upOutcomeIndex(market.outcomes)];
  if (!tokenId) return null;
  try {
    const json = await fetchJson(
      `${POLYMARKET_CLOB_BASE}/midpoint?token_id=${encodeURIComponent(tokenId)}`,
    );
    return parseMidpoint(json);
  } catch {
    return null;
  }
}

function clampProbability(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Fetches the full crowd-odds snapshot for an asset + Horizon: the active
 * market, live Up/Down probabilities (CLOB midpoint, Gamma as fallback), and
 * which Horizons currently have an active market.
 */
export async function fetchCrowdOdds(
  symbol: string,
  horizon: CrowdOddsHorizon,
): Promise<CrowdOddsSnapshot> {
  const now = new Date();
  const perHorizon = await discoverUpDownMarkets(symbol, now);
  const market = perHorizon[horizon];
  const availableHorizons = CROWD_ODDS_HORIZONS.filter((h) => perHorizon[h] != null);

  if (!market) {
    return { market: null, upProbability: 0, downProbability: 0, endTime: "", availableHorizons };
  }

  const upIndex = upOutcomeIndex(market.outcomes);
  const midpoint = await fetchUpMidpoint(market);
  const up = clampProbability(midpoint ?? market.outcomePrices[upIndex] ?? 0);

  return {
    market,
    upProbability: up,
    downProbability: clampProbability(1 - up),
    endTime: market.endDate,
    availableHorizons,
  };
}
