"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "crypto-stocks:chat-collapsed";

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: boolean | null = null;

function readFromStorage(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getSnapshot(): boolean {
  if (cache === null) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(next: boolean) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // localStorage may be unavailable (private browsing, quota) — in-memory cache still works
  }
  listeners.forEach((listener) => listener());
}

export function useChatCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => write(!getSnapshot()), []);

  return { collapsed, toggle };
}
