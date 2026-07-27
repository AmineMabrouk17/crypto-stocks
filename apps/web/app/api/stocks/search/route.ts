import { searchYahoo } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchYahoo(q);
    // Ticker search results change rarely — cache for a few minutes at the edge.
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed", results: [] },
      { status: 502 },
    );
  }
}
