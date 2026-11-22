"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR, { type SWRConfiguration } from "swr";
import { classifyFailure, type PanelFailure } from "./api-error";

/**
 * Last successful fetch per SWR key, kept across remounts so "updated 3m ago"
 * survives a collapse/expand or an asset switch that is served from the SWR
 * cache and therefore never fires `onSuccess` again.
 */
const lastSuccessAt = new Map<string, number>();

/** navigator.onLine, kept in sync with the browser's online/offline events. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return offline;
}

/**
 * A clock that only starts on the client, so server-rendered markup never
 * disagrees with hydration. `null` means "not measured yet".
 */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // First tick after paint: a synchronous setState in an effect body is a
    // cascading render (and trips react-hooks), so let the frame schedule it.
    const raf = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}

interface PanelQueryOptions<T> extends SWRConfiguration<T> {
  /** Runs on every successful payload; for panels that derive state from it. */
  onSnapshot?: (data: T) => void;
}

/**
 * useSWR plus everything the panel state block needs: a classified failure,
 * the last successful fetch time, a stale flag, and a retry that reports its
 * own pending state. Each panel owns its key, so one failing fetch never
 * touches another panel.
 */
export function usePanelQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: PanelQueryOptions<T> = {},
) {
  const { onSnapshot, ...config } = options;
  const isOffline = useIsOffline();
  const [retrying, setRetrying] = useState(false);
  const [stamp, setStamp] = useState<{ key: string; at: number } | null>(null);

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(key, fetcher, {
    ...config,
    onSuccess: (value) => {
      const at = Date.now();
      if (key) lastSuccessAt.set(key, at);
      setStamp(key ? { key, at } : null);
      onSnapshot?.(value);
    },
  });

  const lastUpdatedAt =
    stamp && stamp.key === key ? stamp.at : key ? (lastSuccessAt.get(key) ?? null) : null;

  const retry = useCallback(() => {
    if (!key) return;
    setRetrying(true);
    // SWR surfaces the outcome through `error`/`data`; a rejected mutate is
    // not the UI's business and must not become an unhandled rejection.
    void mutate()
      .catch(() => undefined)
      .finally(() => setRetrying(false));
  }, [key, mutate]);

  // Being offline is a fact about the browser, not an HTTP result: it wins over
  // whatever error the failed request happened to produce.
  const failure: PanelFailure | null = isOffline
    ? { kind: "offline", status: null }
    : error
      ? classifyFailure(error)
      : null;

  return {
    data,
    failure,
    isLoading,
    isValidating,
    isOffline,
    isStale: data !== undefined && (retrying || isValidating || failure !== null),
    isRetrying: retrying,
    lastUpdatedAt,
    retry,
  };
}
