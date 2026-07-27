import { GOOGLE_NEWS_RSS_BASE } from "./constants";
import type { NewsArticle } from "./types";

// Lightweight keyword heuristic, not real sentiment analysis — Google News RSS
// carries no sentiment data, so this just scans the headline for common
// positive/negative financial-news words.
const POSITIVE_WORDS = [
  "surge",
  "surges",
  "rally",
  "rallies",
  "gain",
  "gains",
  "soar",
  "soars",
  "jump",
  "jumps",
  "record high",
  "beat",
  "beats",
  "boost",
  "boosts",
  "rebound",
  "rebounds",
  "climb",
  "climbs",
  "upgrade",
  "upgraded",
];

const NEGATIVE_WORDS = [
  "plunge",
  "plunges",
  "crash",
  "crashes",
  "drop",
  "drops",
  "slump",
  "slumps",
  "miss",
  "misses",
  "warns",
  "warning",
  "sink",
  "sinks",
  "tumble",
  "tumbles",
  "fall",
  "falls",
  "downgrade",
  "downgraded",
  "sell-off",
  "selloff",
];

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripCdata(text: string): string {
  const match = text.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return decodeEntities((match ? match[1] : text).trim());
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? stripCdata(match[1]) : null;
}

function detectSentiment(title: string): "positive" | "negative" | "neutral" {
  const lower = title.toLowerCase();
  const isPositive = POSITIVE_WORDS.some((word) => lower.includes(word));
  const isNegative = NEGATIVE_WORDS.some((word) => lower.includes(word));
  if (isPositive && !isNegative) return "positive";
  if (isNegative && !isPositive) return "negative";
  return "neutral";
}

/** Fetches and hand-parses the Google News RSS feed for `query` — no API key required. */
export async function fetchNewsFeed(query: string): Promise<NewsArticle[]> {
  const url = `${GOOGLE_NEWS_RSS_BASE}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google News RSS request failed: ${res.status}`);
  const xml = await res.text();

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items
    .map((item): NewsArticle => {
      const rawTitle = extractTag(item, "title") ?? "";
      const source = extractTag(item, "source");
      // Google News appends " - <source>" to the title; strip it since the
      // source is already surfaced separately.
      const suffix = source ? ` - ${source}` : null;
      const title = suffix && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;

      return {
        title,
        link: extractTag(item, "link") ?? "",
        source,
        publishedAt: extractTag(item, "pubDate"),
        sentiment: detectSentiment(title),
      };
    })
    .filter((article) => article.title.length > 0 && article.link.length > 0);
}
