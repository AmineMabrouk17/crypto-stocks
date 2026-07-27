import { fetchNewsFeed } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: "Missing required query param: q" }, { status: 400 });
  }

  try {
    const articles = await fetchNewsFeed(q);
    return NextResponse.json({ articles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch news", articles: [] },
      { status: 502 },
    );
  }
}
