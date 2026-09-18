"use client";

import type { AssetRef, ChatMessage, MarketStats } from "@crypto-stocks/lib";
import { FREE_MODELS } from "@crypto-stocks/lib";
import { AlertCircle, PanelRightClose, RotateCcw, Sparkles, X } from "lucide-react";
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

function displaySymbol(asset: AssetRef): string {
  return asset.kind === "crypto" && asset.symbol.endsWith("USDT")
    ? asset.symbol.slice(0, -4)
    : asset.symbol;
}

const CHAT_STORAGE_PREFIX = "crypto-stocks:chat-history:";

function loadMessages(symbol: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(`${CHAT_STORAGE_PREFIX}${symbol}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(symbol: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    if (messages.length === 0) {
      window.sessionStorage.removeItem(`${CHAT_STORAGE_PREFIX}${symbol}`);
    } else {
      window.sessionStorage.setItem(`${CHAT_STORAGE_PREFIX}${symbol}`, JSON.stringify(messages));
    }
  } catch {
    // sessionStorage quota or private browsing fallback
  }
}

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
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(asset.symbol));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { settings: llmSettings } = useLlmSettings();
  const { selected: freeModel, select: selectFreeModel } = useFreeModel();

  const badgeLabel = llmSettings
    ? `${PROVIDER_BADGE_LABELS[llmSettings.provider] ?? llmSettings.provider} · ${llmSettings.model}`
    : freeModel.label;

  // Persist messages whenever they change
  useEffect(() => {
    saveMessages(asset.symbol, messages);
  }, [asset.symbol, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function handleClearChat() {
    setMessages([]);
    saveMessages(asset.symbol, []);
    setShowClearConfirm(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setChatError(null);
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

      if (!res.ok) {
        setChatError(data.error ?? "Failed to connect to the AI model. Please try another model or retry.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setChatError("Network error. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="glass-tile relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl"
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3 sm:px-5 dark:border-white/[0.06]">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h2 className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
              Ask {displaySymbol(asset)}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {!llmSettings && (
              <select
                value={freeModel.id}
                onChange={(e) => {
                  const model = FREE_MODELS.find((m) => m.id === e.target.value);
                  if (model) selectFreeModel(model);
                }}
                aria-label="Select AI model"
                className="w-36 rounded-lg border border-black/10 bg-white/60 px-2 py-1 font-sans text-xs font-medium text-zinc-800 outline-none transition focus:border-indigo-500/50 dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-200 dark:focus:border-indigo-500/60"
              >
                {FREE_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                    {m.label}
                  </option>
                ))}
              </select>
            )}
            {llmSettings && (
              <AnimatedBadge status="info" size="sm" icon={<Sparkles className="h-3 w-3" />}>
                {badgeLabel}
              </AnimatedBadge>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                aria-label="Reset chat history"
                title="Clear conversation"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                aria-label="Collapse AI assistant panel"
                title="Collapse AI assistant"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Clear Confirmation Bar */}
        {showClearConfirm && (
          <div className="flex items-center justify-between border-b border-black/5 bg-zinc-100/80 px-4 py-2 text-xs backdrop-blur-sm dark:border-white/10 dark:bg-zinc-800/80">
            <span className="text-zinc-600 dark:text-zinc-300">Clear chat history for {displaySymbol(asset)}?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearChat}
                className="font-medium text-rose-600 hover:underline dark:text-rose-400"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="text-zinc-500 hover:underline dark:text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4 text-sm sm:px-5"
        >
          {messages.length === 0 && (
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
              <p className="text-zinc-600 dark:text-zinc-400">
                Ask anything about {asset.name} — price action, what it is, recent context.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                m.role === "user"
                  ? "ml-auto border border-indigo-500/20 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100"
                  : "border border-black/5 bg-black/5 dark:border-white/[0.06] dark:bg-white/[0.04]"
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

        {/* Error Alert Banner */}
        {chatError && (
          <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 sm:mx-5 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{chatError}</span>
            </div>
            <button
              type="button"
              onClick={() => setChatError(null)}
              aria-label="Dismiss error"
              className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-500/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Input Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2 border-t border-black/5 p-3 sm:px-5 dark:border-white/[0.06]"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message about ${displaySymbol(asset)}…`}
            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-100 dark:focus:border-indigo-500/60 dark:focus:ring-indigo-500/50"
          />
          <StatefulButton
            type="submit"
            size="md"
            state={(sending ? "loading" : "idle") satisfies ButtonState}
            loadingText="Sending"
            disabled={!input.trim()}
            className="shrink-0 bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Send
          </StatefulButton>
        </form>
      </div>
    </div>
  );
}