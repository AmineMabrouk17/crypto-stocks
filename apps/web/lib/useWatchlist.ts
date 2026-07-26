"use client";

import { DEFAULT_WATCHLIST, type AssetRef } from "@crypto-stocks/lib";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "crypto-stocks:watchlist";

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: AssetRef[] | null = null;

function readFromStorage(): AssetRef[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(raw) as AssetRef[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

function getSnapshot(): AssetRef[] {
  if (!cache) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): AssetRef[] {
  return DEFAULT_WATCHLIST;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeWatchlist(next: AssetRef[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private browsing, quota) — in-memory cache still works
  }
  listeners.forEach((listener) => listener());
}

export function useWatchlist() {
  const watchlist = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addAsset = useCallback((asset: AssetRef) => {
    const current = getSnapshot();
    if (current.some((a) => a.kind === asset.kind && a.symbol === asset.symbol)) return;
    writeWatchlist([...current, asset]);
  }, []);

  const removeAsset = useCallback((asset: AssetRef) => {
    const current = getSnapshot();
    writeWatchlist(current.filter((a) => !(a.kind === asset.kind && a.symbol === asset.symbol)));
  }, []);

  return { watchlist, addAsset, removeAsset };
}
