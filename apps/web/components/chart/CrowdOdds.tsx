"use client";

import type { CrowdOddsHorizon, CrowdOddsSnapshot } from "@crypto-stocks/lib";
import { useState } from "react";
import { fetchJson } from "@/lib/api-error";
import { usePanelQuery } from "@/lib/usePanelQuery";
import { cn } from "@/lib/utils";
import { PanelStatus } from "../feedback/PanelStatus";

async function fetchOdds(url: string): Promise<CrowdOddsSnapshot> {
  const payload = await fetchJson<CrowdOddsSnapshot>(url);
  // A 200 that cannot be drawn is a failure, not "no active market".
  if (typeof payload.upProbability !== "number" || typeof payload.downProbability !== "number") {
    throw new Error("Unexpected crowd odds response");
  }
  return payload;
}

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

export function CrowdOdds({ symbol }: { symbol: string }) {
  const [horizon, setHorizon] = useState<CrowdOddsHorizon>("1D");
  const { data, failure, isLoading, isStale, isRetrying, lastUpdatedAt, retry } =
    usePanelQuery<CrowdOddsSnapshot>(
      `/api/signals/crowd-odds?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`,
      () =>
        fetchOdds(
          `/api/signals/crowd-odds?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`,
        ),
      {
        refreshInterval: 30_000,
        revalidateOnFocus: true,
        onSnapshot: (snapshot) => {
          // Default to 1D when it has a market; a horizon with no Polymarket
          // market is never a valid choice, so an unavailable selection never sticks.
          const available = snapshot.availableHorizons ?? [];
          if (available.length > 0 && !available.includes(horizon)) {
            setHorizon(available.includes("1D") ? "1D" : available[0]);
          }
        },
      },
    );

  const available = data?.availableHorizons ?? [];
  const tabs = available.length > 0 ? available : [horizon];

  const market = data?.market ?? null;

  return (
    <div className="glass-tile flex h-full flex-col gap-3 rounded-3xl p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Crowd Odds
        </span>
        <div className="inline-flex rounded-xl border border-black/10 bg-black/[0.03] p-0.5 dark:border-white/10 dark:bg-white/[0.04]">
          {tabs.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                "rounded-lg px-2.5 py-1 font-mono text-xs font-semibold tabular-nums transition",
                h === horizon
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-white/20 dark:text-white dark:shadow-none"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <PanelStatus
        subject="odds"
        loading={isLoading}
        failure={failure}
        hasData={Boolean(market)}
        emptyMessage="No active market for this horizon."
        isRetrying={isRetrying}
        lastUpdatedAt={lastUpdatedAt}
        onRetry={retry}
        className={market ? undefined : "flex-1 justify-center py-3"}
      />

      {market && data && (
        <div
          aria-busy={isStale || undefined}
          className={cn("flex flex-1 flex-col gap-3 transition-opacity duration-200", isStale && "opacity-60")}
        >
          <SplitBar up={data.upProbability} down={data.downProbability} />
          <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {formatClosesIn(data.endTime)}
          </p>
        </div>
      )}
    </div>
  );
}

function SplitBar({ up, down }: { up: number; down: number }) {
  const total = up + down;
  const normalizedUp = total > 0 ? up / total : 0.5;
  const upPct = Math.min(100, Math.max(0, Math.round(normalizedUp * 100)));
  const downPct = 100 - upPct;

  return (
    <div className="flex flex-1 flex-col justify-center gap-2.5 py-1">
      <div className="flex items-baseline justify-between gap-2 font-mono">
        <span className="flex items-center gap-1.5 text-base font-bold text-signal-up">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-glow-emerald" aria-hidden />
          Up {upPct}%
        </span>
        <span className="flex items-center gap-1.5 text-base font-bold text-signal-down">
          {downPct}% Down
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden />
        </span>
      </div>
      <div
        role="img"
        aria-label={`Up ${upPct}%, Down ${downPct}%`}
        className="flex h-4 w-full gap-1 overflow-hidden rounded-full bg-black/[0.05] p-1 dark:bg-white/[0.05]"
      >
        <span
          className="h-full rounded-l-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-glow-emerald transition-[width] duration-300"
          style={{ width: `${upPct}%` }}
        />
        <span
          className="h-full rounded-r-full bg-gradient-to-r from-rose-500 to-red-600 transition-[width] duration-300"
          style={{ width: `${downPct}%` }}
        />
      </div>
    </div>
  );
}