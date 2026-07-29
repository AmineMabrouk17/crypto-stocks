import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const voterId = searchParams.get("voter_id");

  if (!symbol) {
    return NextResponse.json({ error: "Missing required param: symbol" }, { status: 400 });
  }

  try {
    const { count: up, error: upError } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("asset_symbol", symbol)
      .eq("direction", "up");

    if (upError) throw upError;

    const { count: down, error: downError } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("asset_symbol", symbol)
      .eq("direction", "down");

    if (downError) throw downError;

    let userVote: { direction: string } | null = null;
    if (voterId) {
      const { data: vote } = await supabase
        .from("predictions")
        .select("direction")
        .eq("asset_symbol", symbol)
        .eq("voter_id", voterId)
        .maybeSingle();

      userVote = vote ?? null;
    }

    return NextResponse.json({ up: up ?? 0, down: down ?? 0, userVote });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch counts" },
      { status: 500 },
    );
  }
}
