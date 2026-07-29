import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = getSupabase();
  const { asset_symbol } = await request.json();

  if (!asset_symbol) {
    return NextResponse.json({ error: "Missing required param: asset_symbol" }, { status: 400 });
  }

  try {
    const { data: unresolved, error: fetchError } = await supabase
      .from("predictions")
      .select("id")
      .eq("asset_symbol", asset_symbol)
      .is("resolved_at", null);

    if (fetchError) throw fetchError;

    let resolvedCount = 0;
    if (unresolved && unresolved.length > 0) {
      for (const p of unresolved) {
        const { error: updateError } = await supabase
          .from("predictions")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", p.id);

        if (updateError) throw updateError;
        resolvedCount++;
      }
    }

    return NextResponse.json({ resolved: resolvedCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve predictions" },
      { status: 500 },
    );
  }
}
