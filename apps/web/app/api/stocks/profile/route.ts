import { fetchYahooDescription } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  try {
    const description = await fetchYahooDescription(symbol);
    // Company profiles/descriptions almost never change — cache for an hour at the edge.
    return NextResponse.json(description, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch profile" },
      { status: 502 },
    );
  }
}
