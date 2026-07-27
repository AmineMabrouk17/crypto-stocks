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
    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote" },
      { status: 502 },
    );
  }
}
