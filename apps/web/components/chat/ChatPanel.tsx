"use client";

import type { AssetRef, ChatMessage } from "@crypto-stocks/lib";
import { useEffect, useRef, useState } from "react";
import { StatefulButton, type ButtonState } from "../motion/button/stateful";
import { Loader } from "../motion/loader";

export function ChatPanel({
  asset,
  livePrice,
  description,
}: {
  asset: AssetRef;
  livePrice: number | null;
  description: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          asset: { name: asset.name, symbol: asset.symbol, kind: asset.kind },
          livePrice,
          description,
        }),
      });
      const data = await res.json();
      const reply: string = res.ok ? data.reply : `Error: ${data.error ?? "chat failed"}`;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong reaching the assistant." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-black/10 dark:border-white/15">
      <div className="border-b border-black/10 px-4 py-2 text-sm font-medium dark:border-white/15">
        Ask about {asset.symbol}
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">
            Ask anything about {asset.name} — price action, what it is, recent context.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "ml-auto bg-foreground text-background"
                : "bg-black/5 dark:bg-white/10"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Loader variant="dots" size={16} />
            Thinking…
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex gap-2 border-t border-black/10 p-3 dark:border-white/15"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message about ${asset.symbol}…`}
          className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white/30"
        />
        <StatefulButton
          type="submit"
          size="md"
          state={(sending ? "loading" : "idle") satisfies ButtonState}
          loadingText="Sending"
          disabled={!input.trim()}
        >
          Send
        </StatefulButton>
      </form>
    </div>
  );
}
