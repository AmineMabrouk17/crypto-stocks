import { fetchYahooQuote } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }
  const range = params.get("range") ?? "1d";
  const interval = params.get("interval") ?? "1m";

  try {
    const quote = await fetchYahooQuote(symbol, range, interval);
    // Quotes are polled as often as every 7s (see stockPollingIntervalMs) — keep the CDN/edge
    // cache short so we absorb bursts of duplicate requests without serving stale prices.
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote" },
      { status: 502 },
    );
  }
}
