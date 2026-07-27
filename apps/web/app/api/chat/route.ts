import { formatCurrency, generateChatReply, type ChatMessage, type MarketStats } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

interface ChatRequestBody {
  messages: ChatMessage[];
  asset: {
    name: string;
    symbol: string;
    kind: "crypto" | "stock";
  };
  livePrice: number | null;
  marketStats: MarketStats | null;
  description: string | null;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as ChatRequestBody;
  const { messages, asset, livePrice, marketStats, description } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const priceLine =
    livePrice != null
      ? `Current live price: ${formatCurrency(livePrice)}.`
      : "Live price is currently unavailable.";

  const statsLine =
    marketStats && (marketStats.changePercent != null || marketStats.high != null)
      ? [
          "Live chart data for the currently loaded window:",
          marketStats.changePercent != null
            ? `change ${marketStats.changePercent >= 0 ? "+" : ""}${marketStats.changePercent.toFixed(2)}% since session open`
            : null,
          marketStats.sessionOpen != null ? `open ${formatCurrency(marketStats.sessionOpen)}` : null,
          marketStats.high != null ? `high ${formatCurrency(marketStats.high)}` : null,
          marketStats.low != null ? `low ${formatCurrency(marketStats.low)}` : null,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

  const systemInstruction = [
    "You are a concise financial assistant embedded in a live crypto/stocks dashboard.",
    `The user currently has ${asset.name} (${asset.symbol}, a ${asset.kind === "crypto" ? "cryptocurrency" : "stock/ETF"}) selected.`,
    priceLine,
    statsLine,
    description ? `Background: ${description}` : "",
    "Ground your answers about price action and movement in the live chart data above, not general knowledge. Keep replies short and plain-text. Make clear you are not providing financial advice.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const reply = await generateChatReply(apiKey, systemInstruction, messages);
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 502 },
    );
  }
}
