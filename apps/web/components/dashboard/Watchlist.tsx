"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { useWatchlist } from "@/lib/useWatchlist";
import { logoUrl } from "@/lib/assetLogos";
import { cn } from "@/lib/utils";

function isSameAsset(a: AssetRef, b: AssetRef) {
  return a.kind === b.kind && a.symbol === b.symbol;
}

const CRYPTO_COLORS = {
  gradient: "from-amber-500 to-orange-600",
  badge: "bg-amber-500/10 text-amber-700 border border-amber-500/25 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-500/30",
  accent: "bg-amber-500",
  activeBg: "border-amber-500/20 bg-amber-500/[0.06] dark:bg-amber-500/[0.07]",
  hoverBg: "hover:border-black/5 hover:bg-black/[0.02] dark:hover:border-white/[0.06] dark:hover:bg-white/[0.03]",
} as const;

const STOCK_COLORS = {
  gradient: "from-blue-500 to-indigo-600",
  badge: "bg-blue-500/10 text-blue-700 border border-blue-500/25 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-500/30",
  accent: "bg-blue-500",
  activeBg: "border-blue-500/20 bg-blue-500/[0.06] dark:bg-blue-500/[0.07]",
  hoverBg: "hover:border-black/5 hover:bg-black/[0.02] dark:hover:border-white/[0.06] dark:hover:bg-white/[0.03]",
} as const;

function initials(symbol: string): string {
  return symbol.charAt(0).toUpperCase();
}

function displaySymbol(asset: AssetRef): string {
  return asset.kind === "crypto" && asset.symbol.endsWith("USDT")
    ? asset.symbol.slice(0, -4)
    : asset.symbol;
}

interface WatchlistProps {
  collapsed?: boolean;
}

export function Watchlist({ collapsed = false }: WatchlistProps) {
  const { watchlist, removeAsset } = useWatchlist();
  const { selected, setSelected } = useSelectedAsset();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = (key: string) => {
    setFailedImages((prev) => new Set(prev).add(key));
  };

  if (watchlist.length === 0) {
    if (collapsed) {
      return (
        <div className="flex flex-col items-center py-6 text-zinc-400">
          <Search className="h-4 w-4" />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/10 px-4 py-10 text-center dark:border-white/10">
        <Search className="h-4 w-4 text-zinc-400" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">No assets in your watchlist yet.</p>
        <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          Search above to add a coin or ticker.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", collapsed && "items-center gap-2")} role="list">
      {watchlist.map((asset) => {
        const active = isSameAsset(asset, selected);
        const colors = asset.kind === "crypto" ? CRYPTO_COLORS : STOCK_COLORS;
        const initial = initials(asset.symbol);
        const imageKey = `${asset.kind}:${asset.symbol}`;
        const showImage = !failedImages.has(imageKey);
        const ticker = displaySymbol(asset);

        if (collapsed) {
          return (
            <div key={imageKey} role="listitem" className="group relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => setSelected(asset)}
                title={`${ticker} — ${asset.name} (${asset.kind.toUpperCase()})`}
                aria-label={`${asset.symbol}, ${asset.name}`}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150",
                  "hover:scale-105 hover:shadow-sm focus:outline-none",
                  colors.hoverBg,
                  active
                    ? [colors.activeBg, "border-amber-500/40 dark:border-amber-500/50 shadow-sm"]
                    : "border-transparent"
                )}
              >
                {active && (
                  <div
                    className={cn(
                      "absolute -left-1.5 top-2.5 bottom-2.5 w-1 rounded-full",
                      colors.accent
                    )}
                  />
                )}

                {showImage ? (
                  <img
                    src={logoUrl(asset)}
                    alt={asset.name}
                    onError={() => handleImageError(imageKey)}
                    className="h-7 w-7 flex-shrink-0 rounded-full bg-white/10 object-contain"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm",
                      colors.gradient
                    )}
                  >
                    {initial}
                  </div>
                )}

                {/* Floating tooltip on hover */}
                <div className="pointer-events-none absolute left-full ml-3 z-50 hidden group-hover:flex items-center gap-2 rounded-xl border border-black/10 bg-zinc-900/95 px-2.5 py-1.5 text-xs text-white shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-zinc-800/95 whitespace-nowrap">
                  <span className="font-mono font-semibold">{ticker}</span>
                  <span className="text-zinc-400 text-[11px] max-w-[140px] truncate">{asset.name}</span>
                  <span className={cn("rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase", colors.badge)}>
                    {asset.kind}
                  </span>
                </div>
              </button>
            </div>
          );
        }

        return (
          <div
            key={imageKey}
            role="listitem"
            className={cn(
              "group relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all duration-150",
              "hover:-translate-y-0.5 hover:shadow-sm",
              colors.hoverBg,
              active ? [colors.activeBg, "shadow-sm"] : "border-transparent"
            )}
          >
            {active && (
              <div
                className={cn(
                  "absolute left-0 top-2.5 h-5 w-0.5 rounded-full",
                  colors.accent
                )}
              />
            )}

            {showImage ? (
              <img
                src={logoUrl(asset)}
                alt={asset.name}
                onError={() => handleImageError(imageKey)}
                className="h-8 w-8 flex-shrink-0 rounded-full bg-white/10 object-contain"
              />
            ) : (
              <div
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm",
                  colors.gradient
                )}
              >
                {initial}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelected(asset)}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {ticker}
                </span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
                    colors.badge
                  )}
                >
                  {asset.kind}
                </span>
              </div>
              <span className="w-full truncate text-xs text-zinc-500 dark:text-zinc-400">
                {asset.name}
              </span>
            </button>

            <button
              type="button"
              onClick={() => removeAsset(asset)}
              aria-label={`Remove ${asset.symbol} from watchlist`}
              className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs transition-all duration-150",
                "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                "text-zinc-400 hover:bg-destructive/10 hover:text-destructive dark:text-zinc-500"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}