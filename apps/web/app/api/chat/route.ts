import { generateChatReply, type ChatMessage } from "@crypto-stocks/lib";
import { NextResponse } from "next/server";

interface ChatRequestBody {
  messages: ChatMessage[];
  asset: {
    name: string;
    symbol: string;
    kind: "crypto" | "stock";
  };
  livePrice: number | null;
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
  const { messages, asset, livePrice, description } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const priceLine =
    livePrice != null ? `Current live price: $${livePrice.toLocaleString()}.` : "Live price is currently unavailable.";

  const systemInstruction = [
    "You are a concise financial assistant embedded in a live crypto/stocks dashboard.",
    `The user currently has ${asset.name} (${asset.symbol}, a ${asset.kind === "crypto" ? "cryptocurrency" : "stock/ETF"}) selected.`,
    priceLine,
    description ? `Background: ${description}` : "",
    "Answer questions about this asset using the context above. Keep replies short and plain-text. Make clear you are not providing financial advice.",
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
