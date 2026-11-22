"use client";

import type { PriceAlert } from "@crypto-stocks/lib";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "crypto-stocks:price-alerts";

/** While its asset is open, refresh the persisted "last checked" stamp at most this often. */
const CHECKPOINT_MS = 10_000;

const EMPTY: PriceAlert[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: PriceAlert[] | null = null;

/**
 * Alerts saved before tracking state existed have no `lastCheckedAt`/`pausedAt`.
 * Treat them as never-checked and not-paused rather than dropping them.
 */
function normalizeAlert(value: unknown): PriceAlert | null {
  if (!value || typeof value !== "object") return null;
  const alert = value as Partial<PriceAlert>;
  if (typeof alert.id !== "string" || typeof alert.assetSymbol !== "string") return null;
  if (typeof alert.targetPrice !== "number" || alert.direction === undefined) return null;
  return {
    ...(alert as PriceAlert),
    triggeredAt: typeof alert.triggeredAt === "number" ? alert.triggeredAt : null,
    lastCheckedAt: typeof alert.lastCheckedAt === "number" ? alert.lastCheckedAt : null,
    pausedAt: typeof alert.pausedAt === "number" ? alert.pausedAt : null,
  };
}

function readFromStorage(): PriceAlert[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.map(normalizeAlert).filter((alert): alert is PriceAlert => alert !== null);
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

function isSameAsset(alert: PriceAlert, asset: { kind: string; symbol: string }) {
  return alert.assetKind === asset.kind && alert.assetSymbol === asset.symbol;
}

export type PriceAlertScope = "tracking" | "paused" | "triggered";

/**
 * What an alert is actually doing right now. Tracking additionally requires the
 * asset to be open with a live price; `pausedAt` records the last time that
 * stopped, so a closed tab reads as paused rather than silently active.
 */
export function priceAlertScope(
  alert: PriceAlert,
  context: { assetOpen: boolean; live: boolean },
): PriceAlertScope {
  if (alert.triggeredAt != null) return "triggered";
  if (!context.assetOpen || !context.live) return "paused";
  if (alert.pausedAt != null) return "paused";
  return "tracking";
}

export function usePriceAlerts() {
  const alerts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addAlert = useCallback(
    (alert: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt" | "lastCheckedAt" | "pausedAt">) => {
      const current = getSnapshot();
      const now = Date.now();
      const next: PriceAlert = {
        ...alert,
        id: createAlertId(),
        createdAt: now,
        triggeredAt: null,
        lastCheckedAt: null,
        pausedAt: null,
      };
      writeAlerts([...current, next]);
      return next;
    },
    [],
  );

  const removeAlert = useCallback((id: string) => {
    const current = getSnapshot();
    writeAlerts(current.filter((a) => a.id !== id));
  }, []);

  const markTriggered = useCallback((id: string) => {
    const current = getSnapshot();
    writeAlerts(current.map((a) => (a.id === id ? { ...a, triggeredAt: Date.now() } : a)));
  }, []);

  /**
   * Record that this alert's asset is open and being evaluated. Runs at most
   * once per CHECKPOINT_MS per alert, but immediately resumes a paused alert.
   */
  const markChecked = useCallback((asset: { kind: string; symbol: string }) => {
    const current = getSnapshot();
    const now = Date.now();
    let changed = false;
    const next = current.map((alert) => {
      if (alert.triggeredAt != null || !isSameAsset(alert, asset)) return alert;
      const needsStamp =
        alert.pausedAt != null ||
        alert.lastCheckedAt == null ||
        now - alert.lastCheckedAt >= CHECKPOINT_MS;
      if (!needsStamp) return alert;
      changed = true;
      return { ...alert, lastCheckedAt: now, pausedAt: null };
    });
    if (changed) writeAlerts(next);
  }, []);

  /** Mark a single asset's active alerts paused (asset switched away, tab closing). */
  const pauseAsset = useCallback((asset: { kind: string; symbol: string }) => {
    const current = getSnapshot();
    const now = Date.now();
    let changed = false;
    const next = current.map((alert) => {
      if (alert.triggeredAt != null || alert.pausedAt != null || !isSameAsset(alert, asset)) {
        return alert;
      }
      changed = true;
      return { ...alert, pausedAt: now };
    });
    if (changed) writeAlerts(next);
  }, []);

  /** Pause every active alert whose asset is not the one currently open. */
  const pauseAllExcept = useCallback((asset: { kind: string; symbol: string }) => {
    const current = getSnapshot();
    const now = Date.now();
    let changed = false;
    const next = current.map((alert) => {
      if (alert.triggeredAt != null || alert.pausedAt != null || isSameAsset(alert, asset)) {
        return alert;
      }
      changed = true;
      return { ...alert, pausedAt: now };
    });
    if (changed) writeAlerts(next);
  }, []);

  /** Pause every active alert — used on `pagehide`, when this tab stops watching. */
  const pauseAll = useCallback(() => {
    const current = getSnapshot();
    const now = Date.now();
    let changed = false;
    const next = current.map((alert) => {
      if (alert.triggeredAt != null || alert.pausedAt != null) return alert;
      changed = true;
      return { ...alert, pausedAt: now };
    });
    if (changed) writeAlerts(next);
  }, []);

  return { alerts, addAlert, removeAlert, markTriggered, markChecked, pauseAsset, pauseAllExcept, pauseAll };
}
