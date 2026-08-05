import { fetchFearGreedIndex } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const index = await fetchFearGreedIndex();
    // The index updates daily — cache aggressively so the whole site shares one read.
    return NextResponse.json(index, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sentiment" },
      { status: 502 },
    );
  }
}
