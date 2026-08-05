"use client";

import type { CrowdOddsHorizon, CrowdOddsSnapshot } from "@crypto-stocks/lib";
import useSWR from "swr";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader } from "../motion/loader";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

function formatClosesIn(endTime: string): string {
  const remaining = new Date(endTime).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "closes imminently";
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `closes in ${days}d ${hours}h`;
  if (hours > 0) return `closes in ${hours}h ${minutes}m`;
  if (minutes > 0) return `closes in ${minutes}m`;
  return "closes in <1m";
}

/**
 * Real-money Polymarket Up/Down odds for the selected crypto asset, refreshed
 * on a 30s cadence. Tabs show only the Horizons with an active market.
 */
export function CrowdOdds({ symbol }: { symbol: string }) {
  const [horizon, setHorizon] = useState<CrowdOddsHorizon>("1D");
  const { data, isLoading, error } = useSWR<CrowdOddsSnapshot>(
    `/api/signals/crowd-odds?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      // Default to 1D when it has a market, otherwise the first active cadence.
      // The key change re-fetches, so an unavailable selection never sticks.
      onSuccess: (snapshot) => {
        const available = snapshot.availableHorizons ?? [];
        if (available.length > 0 && !available.includes(horizon)) {
          setHorizon(available.includes("1D") ? "1D" : available[0]);
        }
      },
    },
  );

  const available = data?.availableHorizons ?? [];
  // Only cadences with an active market become tabs; when none exist, the
  // currently selected Horizon stays as the sole tab so the empty state reads
  // clearly instead of collapsing the card.
  const tabs = available.length > 0 ? available : [horizon];

  const market = data?.market ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Crowd Odds
        </span>
        <div className="flex items-center gap-0.5 rounded-md border border-black/10 p-0.5 dark:border-white/10">
          {tabs.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium tabular-nums",
                h === horizon
                  ? "bg-foreground text-background"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Loader variant="dots" size={16} />
          Loading odds…
        </div>
      )}

      {!isLoading && (error || !data) && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Odds unavailable right now.</p>
      )}

      {!isLoading && data && !market && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">No active market</p>
      )}

      {!isLoading && data && market && (
        <>
          <SplitBar up={data.upProbability} down={data.downProbability} />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {formatClosesIn(data.endTime)}
          </p>
        </>
      )}
    </div>
  );
}

function SplitBar({ up, down }: { up: number; down: number }) {
  const upPct = Math.round(up * 100);
  const downPct = Math.round(down * 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between font-mono text-xs font-semibold tabular-nums">
        <span className="text-green-600 dark:text-green-400">Up {upPct}%</span>
        <span className="text-red-600 dark:text-red-400">{downPct}% Down</span>
      </div>
      <div
        role="img"
        aria-label={`Up ${upPct}%, Down ${downPct}%`}
        className="flex h-2 w-full overflow-hidden rounded-full bg-red-500"
      >
        <span className="h-full bg-green-500" style={{ width: `${upPct}%` }} />
      </div>
    </div>
  );
}
