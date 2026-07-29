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
    await supabase
      .from("predictions")
      .delete()
      .eq("asset_symbol", asset_symbol)
      .eq("voter_id", voter_id);

    const { data, error } = await supabase
      .from("predictions")
      .insert({ asset_symbol, direction, predicted_price, voter_id })
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
