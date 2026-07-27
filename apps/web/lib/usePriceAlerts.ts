"use client";

import type { PriceAlert } from "@crypto-stocks/lib";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "crypto-stocks:price-alerts";

const EMPTY: PriceAlert[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: PriceAlert[] | null = null;

function readFromStorage(): PriceAlert[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as PriceAlert[];
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): PriceAlert[] {
  if (!cache) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): PriceAlert[] {
  return EMPTY;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeAlerts(next: PriceAlert[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private browsing, quota) — in-memory cache still works
  }
  listeners.forEach((listener) => listener());
}

function createAlertId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function usePriceAlerts() {
  const alerts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addAlert = useCallback((alert: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt">) => {
    const current = getSnapshot();
    const next: PriceAlert = {
      ...alert,
      id: createAlertId(),
      createdAt: Date.now(),
      triggeredAt: null,
    };
    writeAlerts([...current, next]);
    return next;
  }, []);

  const removeAlert = useCallback((id: string) => {
    const current = getSnapshot();
    writeAlerts(current.filter((a) => a.id !== id));
  }, []);

  const markTriggered = useCallback((id: string) => {
    const current = getSnapshot();
    writeAlerts(current.map((a) => (a.id === id ? { ...a, triggeredAt: Date.now() } : a)));
  }, []);

  return { alerts, addAlert, removeAlert, markTriggered };
}
