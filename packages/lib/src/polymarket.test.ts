import { describe, expect, it } from "vitest";
import {
  POLYMARKET_CURATED,
  dailySlugs,
  fourHourSlugs,
  horizonForSlug,
  parseMidpoint,
  parsePolymarketMarket,
  selectNearestMarket,
  upOutcomeIndex,
} from "./polymarket";

// Captured from gamma-api.polymarket.com/markets?slug=btc-updown-4h-1785960000 (Aug 2026).
const BTC_4H_FIXTURE = {
  id: "3346519",
  question: "Bitcoin Up or Down - August 5, 4:00PM-8:00PM ET",
  slug: "btc-updown-4h-1785960000",
  conditionId: "0x6bd598629e581a9fba9ad367c2e5300214562639bbebf03a09bec31db3aad378",
  endDate: "2026-08-06T00:00:00Z",
  startDate: "2026-08-04T20:07:34.802349Z",
  active: true,
  closed: false,
  archived: false,
  outcomes: '["Up", "Down"]',
  outcomePrices: '["0.505", "0.495"]',
  clobTokenIds:
    '["10360615685715835102052505712716928482293991285244385425471576343469847481741", "40181910861246356970463709176007519371839958130956661754177947848998648061933"]',
  volume: "54.098034999999996",
  liquidity: "8305.3266",
  lastTradePrice: 0.51,
  bestBid: 0.5,
  bestAsk: 0.51,
};

// Captured from gamma-api.polymarket.com/markets?slug=bitcoin-up-or-down-on-august-6-2026 (Aug 2026).
const BTC_DAILY_FIXTURE = {
  id: "3340215",
  question: "Bitcoin Up or Down on August 6?",
  slug: "bitcoin-up-or-down-on-august-6-2026",
  conditionId: "0xff8fe28c0296aedfc3c7f894a5e8c2a658c702c61cd1944204a1bf00ec88dbad",
  endDate: "2026-08-06T16:00:00Z",
  startDate: "2026-08-04T16:07:09Z",
  active: true,
  closed: false,
  archived: false,
  outcomes: '["Up", "Down"]',
  outcomePrices: '["0.705", "0.295"]',
  clobTokenIds: [
    "16465209773910222414384252480583419176142777026690356950677518532294059732363",
    "15358153318025157781697490478466994453906327951735452002768391726210557110820",
  ],
  volume: "39225.73656899999",
  liquidity: "29545.2782",
  lastTradePrice: 0.7,
  bestBid: 0.7,
  bestAsk: 0.71,
};

// Captured from clob.polymarket.com/midpoint?token_id=16465209773910222414384252480583419176142777026690356950677518532294059732363 (Aug 2026).
const MIDPOINT_FIXTURE = { mid: "0.705" };

const FIXED_NOW = new Date("2026-08-05T19:45:00Z");

describe("parsePolymarketMarket", () => {
  it("decodes the double-encoded arrays of a real 4h record", () => {
    const market = parsePolymarketMarket(BTC_4H_FIXTURE);

    expect(market.slug).toBe("btc-updown-4h-1785960000");
    expect(market.outcomes).toEqual(["Up", "Down"]);
    expect(market.outcomePrices).toEqual([0.505, 0.495]);
    expect(market.clobTokenIds).toHaveLength(2);
    expect(market.clobTokenIds[0]).toMatch(/^\d{70,}$/);
    expect(market.endDate).toBe("2026-08-06T00:00:00Z");
    expect(market.active).toBe(true);
    expect(market.closed).toBe(false);
  });

  it("decodes a daily record whose arrays were already native", () => {
    const market = parsePolymarketMarket(BTC_DAILY_FIXTURE);

    expect(market.outcomes).toEqual(["Up", "Down"]);
    expect(market.outcomePrices).toEqual([0.705, 0.295]);
    expect(market.clobTokenIds).toHaveLength(2);
    expect(market.endDate).toBe("2026-08-06T16:00:00Z");
  });

  it("throws when the record has no outcomes", () => {
    expect(() =>
      parsePolymarketMarket({ slug: "btc-updown-4h-1785960000", outcomePrices: '["0.5", "0.5"]' }),
    ).toThrow("missing outcomes");
  });

  it("throws when the record has no slug", () => {
    expect(() => parsePolymarketMarket({ outcomes: '["Up", "Down"]' })).toThrow("missing slug");
  });
});

describe("horizonForSlug", () => {
  it("classifies the three cadence families", () => {
    expect(horizonForSlug("btc-updown-4h-1785960000")).toBe("4h");
    expect(horizonForSlug("bitcoin-up-or-down-on-august-6-2026")).toBe("1D");
    expect(horizonForSlug("bitcoin-up-or-down-this-week")).toBe("1W");
  });

  it("returns null for cadences outside the widget (5m / 15m / 1h)", () => {
    expect(horizonForSlug("btc-updown-5m-1775181000")).toBeNull();
    expect(horizonForSlug("eth-updown-15m-1786044600")).toBeNull();
    expect(horizonForSlug("bitcoin-up-or-down-february-23-12pm-et")).toBeNull();
  });
});

describe("POLYMARKET_CURATED", () => {
  it("maps each major to its slug prefixes and search phrase", () => {
    expect(POLYMARKET_CURATED.BTCUSDT.short).toBe("btc");
    expect(POLYMARKET_CURATED.BTCUSDT.name).toBe("bitcoin");
    expect(POLYMARKET_CURATED.ETHUSDT.name).toBe("ethereum");
    expect(POLYMARKET_CURATED.SOLUSDT.short).toBe("sol");
    expect(POLYMARKET_CURATED.XRPUSDT.name).toBe("xrp");
    expect(POLYMARKET_CURATED.DOGEUSDT.short).toBe("doge");
    expect(POLYMARKET_CURATED.BNBUSDT.name).toBe("bnb");
  });
});

describe("selectNearestMarket", () => {
  it("picks the open market with the nearest end time", () => {
    const market = parsePolymarketMarket(BTC_4H_FIXTURE);
    const daily = parsePolymarketMarket(BTC_DAILY_FIXTURE);

    const picked = selectNearestMarket([daily, market]);
    expect(picked?.slug).toBe("btc-updown-4h-1785960000");
  });

  it("ignores closed markets", () => {
    const market = parsePolymarketMarket(BTC_4H_FIXTURE);
    const closed = { ...BTC_4H_FIXTURE, slug: "btc-updown-4h-1785974400", closed: true };

    expect(selectNearestMarket([parsePolymarketMarket(closed)])).toBeNull();
    expect(selectNearestMarket([market, parsePolymarketMarket(closed)])?.slug).toBe(
      "btc-updown-4h-1785960000",
    );
  });

  it("returns null for an empty or all-closed set", () => {
    expect(selectNearestMarket([])).toBeNull();
  });
});

describe("upOutcomeIndex", () => {
  it("prefers an explicit Up outcome, falling back to Yes or the first index", () => {
    expect(upOutcomeIndex(["Up", "Down"])).toBe(0);
    expect(upOutcomeIndex(["Down", "Up"])).toBe(1);
    expect(upOutcomeIndex(["Yes", "No"])).toBe(0);
    expect(upOutcomeIndex(["Heads", "Tails"])).toBe(0);
  });
});

describe("parseMidpoint", () => {
  it("parses a real CLOB midpoint body", () => {
    expect(parseMidpoint(MIDPOINT_FIXTURE)).toBe(0.705);
  });

  it("rejects missing, malformed or out-of-range values", () => {
    expect(parseMidpoint({})).toBeNull();
    expect(parseMidpoint({ mid: "oops" })).toBeNull();
    expect(parseMidpoint({ mid: "1.4" })).toBeNull();
    expect(parseMidpoint(null)).toBeNull();
  });
});

describe("slug candidate builders", () => {
  it("builds the 4h window slugs for the live ET window", () => {
    const slugs = fourHourSlugs(POLYMARKET_CURATED.BTCUSDT, FIXED_NOW);
    expect(slugs).toEqual([
      "btc-updown-4h-1785945600",
      "btc-updown-4h-1785960000",
      "btc-updown-4h-1785974400",
    ]);
  });

  it("builds the daily slugs for the next three ET dates", () => {
    const slugs = dailySlugs(POLYMARKET_CURATED.BTCUSDT, FIXED_NOW);
    expect(slugs).toEqual([
      "bitcoin-up-or-down-on-august-5-2026",
      "bitcoin-up-or-down-on-august-6-2026",
      "bitcoin-up-or-down-on-august-7-2026",
    ]);
  });
});
