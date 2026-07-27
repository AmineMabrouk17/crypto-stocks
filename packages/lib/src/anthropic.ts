import type { ChatMessage } from "./types";

export const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

/** Calls the Anthropic Messages API. */
export async function generateChatReplyAnthropic(
  apiKey: string,
  model: string,
  systemInstruction: string,
  messages: ChatMessage[],
): Promise<string> {
  const url = `${ANTHROPIC_API_BASE}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      system: systemInstruction,
      max_tokens: 1024,
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic request failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const reply: string | undefined = data?.content?.[0]?.text;

  return reply?.trim() || "I couldn't generate a response for that.";
}
