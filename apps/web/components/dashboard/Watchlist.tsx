"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { X } from "lucide-react";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { useWatchlist } from "@/lib/useWatchlist";
import { cn } from "@/lib/utils";

function isSameAsset(a: AssetRef, b: AssetRef) {
  return a.kind === b.kind && a.symbol === b.symbol;
}

const CRYPTO_COLORS = {
  gradient: "from-amber-500 to-orange-600",
  badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  accent: "bg-amber-500",
  activeBg: "bg-amber-50 dark:bg-amber-950/20",
  hoverBg: "hover:bg-amber-50/50 dark:hover:bg-amber-950/10",
} as const;

const STOCK_COLORS = {
  gradient: "from-blue-500 to-indigo-600",
  badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  accent: "bg-blue-500",
  activeBg: "bg-blue-50 dark:bg-blue-950/20",
  hoverBg: "hover:bg-blue-50/50 dark:hover:bg-blue-950/10",
} as const;

function initials(symbol: string): string {
  return symbol.charAt(0).toUpperCase();
}

function displaySymbol(asset: AssetRef): string {
  return asset.kind === "crypto" && asset.symbol.endsWith("USDT")
    ? asset.symbol.slice(0, -4)
    : asset.symbol;
}

export function Watchlist() {
  const { watchlist, removeAsset } = useWatchlist();
  const { selected, setSelected } = useSelectedAsset();

  return (
    <div className="flex flex-col gap-1" role="list">
      {watchlist.map((asset) => {
        const active = isSameAsset(asset, selected);
        const colors = asset.kind === "crypto" ? CRYPTO_COLORS : STOCK_COLORS;
        const initial = initials(asset.symbol);

        return (
          <div
            key={`${asset.kind}:${asset.symbol}`}
            role="listitem"
            className={cn(
              "group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all duration-150",
              "hover:-translate-y-0.5 hover:shadow-sm",
              colors.hoverBg,
              active
                ? [colors.activeBg, "border-sidebar-border shadow-sm"]
                : "border-transparent",
            )}
          >
            {active && (
              <div
                className={cn(
                  "absolute left-0 top-2 h-5 w-0.5 rounded-full",
                  colors.accent,
                )}
              />
            )}

            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm",
                colors.gradient,
              )}
            >
              {initial}
            </div>

            <button
              type="button"
              onClick={() => setSelected(asset)}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold tracking-tight">
                  {displaySymbol(asset)}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    colors.badge,
                  )}
                >
                  {asset.kind}
                </span>
              </div>
              <span className="w-full truncate text-xs text-muted-foreground">
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
                "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
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
