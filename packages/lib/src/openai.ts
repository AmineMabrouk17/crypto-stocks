import type { ChatMessage } from "./types";

export const OPENAI_API_BASE = "https://api.openai.com/v1";

/**
 * Calls an OpenAI (or OpenAI-compatible) chat completions endpoint.
 * `baseUrl` should not include a trailing slash or `/chat/completions` suffix —
 * pass `OPENAI_API_BASE` for the official API, or a user-supplied base URL for "custom" providers.
 */
export async function generateChatReplyOpenAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemInstruction: string,
  messages: ChatMessage[],
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemInstruction },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI request failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const reply: string | undefined = data?.choices?.[0]?.message?.content;

  return reply?.trim() || "I couldn't generate a response for that.";
}
