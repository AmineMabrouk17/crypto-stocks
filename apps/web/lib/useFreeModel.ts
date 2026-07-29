"use client";

import { FREE_MODELS, type FreeModel } from "@crypto-stocks/lib";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "crypto-stocks:free-model";

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: FreeModel | null | undefined;
const defaultModel = FREE_MODELS[0];

function readFromStorage(): FreeModel {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultModel;
    const parsed = FREE_MODELS.find((m) => m.id === raw);
    return parsed ?? defaultModel;
  } catch {
    return defaultModel;
  }
}

function getSnapshot(): FreeModel {
  if (cache === undefined) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): FreeModel {
  return defaultModel;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(next: FreeModel) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next.id);
  } catch {
    // localStorage may be unavailable (private browsing, quota) — in-memory cache still works
  }
  listeners.forEach((listener) => listener());
}

export function useFreeModel() {
  const selected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const select = useCallback((model: FreeModel) => {
    write(model);
  }, []);

  return { selected, select };
}
