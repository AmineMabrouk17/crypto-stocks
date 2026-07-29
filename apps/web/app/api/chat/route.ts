import {
  FREE_MODELS,
  GROQ_API_BASE,
  formatCurrency,
  generateChatReply,
  generateChatReplyAnthropic,
  generateChatReplyOpenAI,
  OPENAI_API_BASE,
  type ChatMessage,
  type LlmSettings,
  type MarketStats,
} from "@crypto-stocks/lib";
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
  /** Optional BYOK settings from the client. When present, the request is routed to the
   * user's chosen provider using their own key instead of the server's default Gemini key. */
  llmSettings?: LlmSettings | null;
  /** ID of a free built-in model (from FREE_MODELS) to use. Ignored when llmSettings is set. */
  freeModelId?: string | null;
}

function buildSystemInstruction(
  asset: ChatRequestBody["asset"],
  livePrice: number | null,
  marketStats: MarketStats | null,
  description: string | null,
): string {
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

  return [
    "You are a concise financial assistant embedded in a live crypto/stocks dashboard.",
    `The user currently has ${asset.name} (${asset.symbol}, a ${asset.kind === "crypto" ? "cryptocurrency" : "stock/ETF"}) selected.`,
    priceLine,
    statsLine,
    description ? `Background: ${description}` : "",
    "Ground your answers about price action and movement in the live chart data above, not general knowledge. Keep replies short and plain-text. Make clear you are not providing financial advice.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;
  const { messages, asset, livePrice, marketStats, description, llmSettings, freeModelId } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const systemInstruction = buildSystemInstruction(asset, livePrice, marketStats, description);

  try {
    let reply: string;

    if (llmSettings?.apiKey) {
      // BYOK path: the user supplied their own provider + key from the settings panel.
      switch (llmSettings.provider) {
        case "openai":
          reply = await generateChatReplyOpenAI(
            llmSettings.apiKey,
            OPENAI_API_BASE,
            llmSettings.model,
            systemInstruction,
            messages,
          );
          break;
        case "anthropic":
          reply = await generateChatReplyAnthropic(
            llmSettings.apiKey,
            llmSettings.model,
            systemInstruction,
            messages,
          );
          break;
        case "groq":
          reply = await generateChatReplyOpenAI(
            llmSettings.apiKey,
            GROQ_API_BASE,
            llmSettings.model,
            systemInstruction,
            messages,
          );
          break;
        case "custom":
          if (!llmSettings.customBaseUrl) {
            return NextResponse.json(
              { error: "customBaseUrl is required for the custom provider" },
              { status: 400 },
            );
          }
          reply = await generateChatReplyOpenAI(
            llmSettings.apiKey,
            llmSettings.customBaseUrl,
            llmSettings.model,
            systemInstruction,
            messages,
          );
          break;
        case "gemini":
        default:
          reply = await generateChatReply(llmSettings.apiKey, systemInstruction, messages);
          break;
      }
    } else if (freeModelId) {
      // Free built-in model path: route to the provider using server-side env vars.
      const model = FREE_MODELS.find((m) => m.id === freeModelId);
      if (!model) {
        return NextResponse.json(
          { error: `Unknown free model: ${freeModelId}` },
          { status: 400 },
        );
      }

      switch (model.provider) {
        case "groq": {
          const apiKey = process.env.GROQ_API_KEY;
          if (!apiKey) {
            return NextResponse.json(
              { error: "GROQ_API_KEY is not configured on the server" },
              { status: 500 },
            );
          }
          reply = await generateChatReplyOpenAI(apiKey, GROQ_API_BASE, model.modelId, systemInstruction, messages);
          break;
        }
        case "gemini":
        default: {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            return NextResponse.json(
              { error: "GEMINI_API_KEY is not configured on the server" },
              { status: 500 },
            );
          }
          reply = await generateChatReply(apiKey, systemInstruction, messages);
          break;
        }
      }
    } else {
      // Default path: no BYOK and no freeModelId — use the app's server-side Gemini key.
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY is not configured on the server" },
          { status: 500 },
        );
      }
      reply = await generateChatReply(apiKey, systemInstruction, messages);
    }

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 502 },
    );
  }
}
