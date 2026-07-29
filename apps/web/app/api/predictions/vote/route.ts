import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = getSupabase();
  const { asset_symbol, direction, predicted_price, voter_id } = await request.json();

  if (!asset_symbol || !direction || predicted_price == null || !voter_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ error: "direction must be 'up' or 'down'" }, { status: 400 });
  }

  try {
    const { data: existing } = await supabase
      .from("predictions")
      .select("id, direction, predicted_price")
      .eq("asset_symbol", asset_symbol)
      .eq("voter_id", voter_id)
      .is("correct", null)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("predictions")
        .update({ resolved_at: new Date().toISOString(), correct: false })
        .eq("id", existing.id);
    }

    const { data, error } = await supabase
      .from("predictions")
      .insert({
        asset_symbol,
        direction,
        predicted_price,
        voter_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, prediction: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit vote" },
      { status: 500 },
    );
  }
}
