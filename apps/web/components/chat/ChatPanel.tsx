"use client";

import type { AssetRef, ChatMessage, MarketStats } from "@crypto-stocks/lib";
import { FREE_MODELS } from "@crypto-stocks/lib";
import { PanelRightClose, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFreeModel } from "@/lib/useFreeModel";
import { useLlmSettings } from "@/lib/useLlmSettings";
import { AnimatedBadge } from "../motion/animated-badge";
import { StatefulButton, type ButtonState } from "../motion/button/stateful";
import { Loader } from "../motion/loader";
import { TextReveal } from "../motion/text-reveal";

const PROVIDER_BADGE_LABELS: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
  groq: "Groq",
  custom: "Custom",
};

export function ChatPanel({
  asset,
  livePrice,
  marketStats,
  description,
  onCollapse,
}: {
  asset: AssetRef;
  livePrice: number | null;
  marketStats: MarketStats;
  description: string | null;
  onCollapse?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { settings: llmSettings } = useLlmSettings();
  const { selected: freeModel, select: selectFreeModel } = useFreeModel();

  const badgeLabel = llmSettings
    ? `${PROVIDER_BADGE_LABELS[llmSettings.provider] ?? llmSettings.provider} · ${llmSettings.model}`
    : freeModel.label;

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
          marketStats,
          description,
          llmSettings,
          freeModelId: llmSettings ? undefined : freeModel.id,
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
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-2 dark:border-white/15">
        <span className="text-sm font-medium">Ask about {asset.symbol}</span>
        <div className="flex items-center gap-2">
          {!llmSettings && (
            <select
              value={freeModel.id}
              onChange={(e) => {
                const model = FREE_MODELS.find((m) => m.id === e.target.value);
                if (model) selectFreeModel(model);
              }}
              aria-label="Select AI model"
              className="w-28 rounded-md border border-black/10 bg-white px-1.5 py-1 text-[11px] outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white/30"
            >
              {FREE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
          {llmSettings && (
            <AnimatedBadge status="info" size="sm" icon={<Sparkles className="h-3.5 w-3.5" />}>
              {badgeLabel}
            </AnimatedBadge>
          )}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Collapse AI assistant panel"
              title="Collapse AI assistant"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>
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
            {m.role === "assistant" ? (
              <TextReveal
                text={m.content}
                split="word"
                stagger={0.025}
                blur={6}
                yOffset="30%"
              />
            ) : (
              m.content
            )}
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
