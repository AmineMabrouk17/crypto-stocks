"use client";

import type { LlmProvider, LlmSettings } from "@crypto-stocks/lib";
import { X } from "lucide-react";
import { useState } from "react";
import { useLlmSettings } from "@/lib/useLlmSettings";
import { StatefulButton, type ButtonState } from "../motion/button/stateful";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  custom: "Custom (OpenAI-compatible)",
};

const MODEL_PLACEHOLDERS: Record<LlmProvider, string> = {
  gemini: "gemini-flash-latest",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  custom: "your-model-id",
};

const TEST_ASSET = { name: "Bitcoin", symbol: "BTC", kind: "crypto" as const };

// The panel is only mounted (by the parent) while `open` is true, so every open freshly
// mounts this form component — its useState initializers re-read the latest saved settings
// with no synchronization effect required (avoids setState-in-effect entirely).
export function LlmSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <LlmSettingsForm onClose={onClose} />;
}

function LlmSettingsForm({ onClose }: { onClose: () => void }) {
  const { settings, saveSettings, clearSettings } = useLlmSettings();

  const [provider, setProvider] = useState<LlmProvider>(settings?.provider ?? "gemini");
  const [apiKey, setApiKey] = useState(settings?.apiKey ?? "");
  const [model, setModel] = useState(settings?.model ?? "");
  const [customBaseUrl, setCustomBaseUrl] = useState(settings?.customBaseUrl ?? "");
  const [testState, setTestState] = useState<ButtonState>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDefaultGemini = provider === "gemini" && !apiKey.trim();
  const effectiveModel = model.trim() || MODEL_PLACEHOLDERS[provider];

  function resetTransient() {
    setTestState("idle");
    setTestMessage(null);
    setSaved(false);
  }

  function buildDraft(): LlmSettings | null {
    if (isDefaultGemini) return null;
    return {
      provider,
      apiKey: apiKey.trim(),
      model: effectiveModel,
      customBaseUrl: provider === "custom" ? customBaseUrl.trim() : undefined,
    };
  }

  async function handleTest() {
    setTestState("loading");
    setTestMessage(null);
    try {
      const draft = buildDraft();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Reply with just the word OK." }],
          asset: TEST_ASSET,
          livePrice: null,
          marketStats: null,
          description: null,
          llmSettings: draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test request failed");
      setTestState("success");
      setTestMessage(`Connected. Reply: "${String(data.reply).slice(0, 80)}"`);
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : "Test request failed");
    }
  }

  function handleSave() {
    const draft = buildDraft();
    if (draft) {
      saveSettings(draft);
    } else {
      clearSettings();
    }
    setSaved(true);
  }

  function handleUseDefault() {
    clearSettings();
    setProvider("gemini");
    setApiKey("");
    setModel("");
    setCustomBaseUrl("");
    setTestState("idle");
    setTestMessage(null);
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative flex w-full max-w-md flex-col rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/15 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
          <h2 className="text-sm font-semibold">AI assistant settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4 text-sm">
          <p className="rounded-lg bg-black/5 px-3 py-2 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
            Bring your own API key to use a different provider or model. Your key is stored only
            in your browser (localStorage) and sent directly to your chosen provider — never to
            our servers. Leave the key blank to keep using this app&apos;s default Gemini
            assistant.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Provider</span>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as LlmProvider);
                resetTransient();
              }}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white/30"
            >
              {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">API key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                resetTransient();
              }}
              placeholder={
                provider === "gemini" ? "Leave blank to use the app default" : "sk-..."
              }
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white/30"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Model</span>
            <input
              type="text"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                resetTransient();
              }}
              placeholder={MODEL_PLACEHOLDERS[provider]}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white/30"
            />
          </label>

          {provider === "custom" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Base URL
              </span>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => {
                  setCustomBaseUrl(e.target.value);
                  resetTransient();
                }}
                placeholder="https://your-endpoint.example.com/v1"
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white/30"
              />
            </label>
          )}

          <div className="flex items-center gap-2">
            <StatefulButton
              type="button"
              size="sm"
              variant="outline"
              state={testState}
              loadingText="Testing"
              successText="Connected"
              errorText="Failed"
              disabled={isDefaultGemini || !apiKey.trim() || (provider === "custom" && !customBaseUrl.trim())}
              onClick={handleTest}
            >
              Test connection
            </StatefulButton>
            {testMessage && (
              <span
                className={`text-xs ${testState === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {testMessage}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-black/10 px-4 py-3 dark:border-white/15">
          <button
            type="button"
            onClick={handleUseDefault}
            className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Use app default
          </button>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>}
            <StatefulButton type="button" size="sm" state="idle" onClick={handleSave}>
              Save
            </StatefulButton>
          </div>
        </div>
      </div>
    </div>
  );
}
