"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { useWatchlist } from "@/lib/useWatchlist";
import { SharedLayoutBg } from "../motion/shared-layout-bg";

function isSameAsset(a: AssetRef, b: AssetRef) {
  return a.kind === b.kind && a.symbol === b.symbol;
}

export function Watchlist() {
  const { watchlist, removeAsset } = useWatchlist();
  const { selected, setSelected } = useSelectedAsset();

  return (
    <SharedLayoutBg className="gap-1" pillClassName="bg-primary/[0.08] dark:bg-primary/[0.12]">
      {watchlist.map((asset) => {
        const active = isSameAsset(asset, selected);
        return (
          <div
            key={`${asset.kind}:${asset.symbol}`}
            role="listitem"
            className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              active ? "bg-foreground text-background" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setSelected(asset)}
              className="flex flex-1 items-center gap-2 text-left"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  active
                    ? "bg-background/20"
                    : "bg-black/5 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                }`}
              >
                {asset.kind === "crypto" ? "crypto" : "stock"}
              </span>
              <span className="font-medium">{asset.symbol}</span>
              <span
                className={`truncate text-xs ${active ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {asset.name}
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeAsset(asset)}
              aria-label={`Remove ${asset.symbol} from watchlist`}
              className={`ml-2 rounded px-1 text-xs opacity-0 group-hover:opacity-100 ${
                active ? "hover:bg-background/20" : "hover:bg-black/10 dark:hover:bg-white/10"
              }`}
            >
              ×
            </button>
          </div>
        );
      })}
    </SharedLayoutBg>
  );
}
