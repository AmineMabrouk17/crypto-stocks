"use client";

import type { LlmSettings } from "@crypto-stocks/lib";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "crypto-stocks:llm-settings";

type Listener = () => void;
const listeners = new Set<Listener>();
// `undefined` means "not read from storage yet", `null` means "no BYOK settings saved —
// use the app's default server-side Gemini key".
let cache: LlmSettings | null | undefined;

function readFromStorage(): LlmSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LlmSettings;
    if (!parsed || typeof parsed !== "object" || !parsed.provider || !parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getSnapshot(): LlmSettings | null {
  if (cache === undefined) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): LlmSettings | null {
  return null;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeLlmSettings(next: LlmSettings | null) {
  cache = next;
  try {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private browsing, quota) — in-memory cache still works
  }
  listeners.forEach((listener) => listener());
}

export function useLlmSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const saveSettings = useCallback((next: LlmSettings) => {
    writeLlmSettings(next);
  }, []);

  const clearSettings = useCallback(() => {
    writeLlmSettings(null);
  }, []);

  return { settings, saveSettings, clearSettings };
}
