import { GEMINI_API_BASE } from "./constants";
import type { ChatMessage } from "./types";

export async function generateChatReply(
  apiKey: string,
  systemInstruction: string,
  messages: ChatMessage[],
  model?: string,
): Promise<string> {
  const modelId = model ?? "gemini-flash-latest";
  const url = `${GEMINI_API_BASE}/models/${modelId}:generateContent`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const reply: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");

  return reply?.trim() || "I couldn't generate a response for that.";
}
