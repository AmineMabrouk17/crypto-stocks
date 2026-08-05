import { CROWD_ODDS_HORIZONS, fetchCrowdOdds, type CrowdOddsHorizon } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase();
  const horizon = searchParams.get("horizon") as CrowdOddsHorizon | null;

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }
  if (!horizon || !CROWD_ODDS_HORIZONS.includes(horizon)) {
    return NextResponse.json({ error: "Invalid horizon" }, { status: 400 });
  }

  try {
    const snapshot = await fetchCrowdOdds(symbol, horizon);
    // Odds move constantly — short client TTL, but let the shared cache absorb
    // the spiky Gamma discovery calls between refreshes.
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch crowd odds" },
      { status: 502 },
    );
  }
}
