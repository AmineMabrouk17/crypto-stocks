"use client";

import { EyeOff, ListOrdered, Sparkles } from "lucide-react";
import { useState } from "react";
import { useChatCollapsed } from "@/lib/useChatCollapsed";
import { useWatchlist } from "@/lib/useWatchlist";
import { AssetDescriptionPanel } from "../asset/AssetDescriptionPanel";
import { NewsFeed } from "../asset/NewsFeed";
import { ChatPanel } from "../chat/ChatPanel";
import { CrowdOdds } from "../chart/CrowdOdds";
import { SentimentIndex } from "../chart/SentimentIndex";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { useWatchlistVisible } from "@/lib/useWatchlistVisible";
import { AssetChartPanel } from "./AssetChartPanel";
import { AssetSearchBar } from "./AssetSearchBar";
import { Watchlist } from "./Watchlist";

export function DashboardGrid() {
  const { selected, livePrice, marketStats } = useSelectedAsset();
  const { watchlist } = useWatchlist();
  const [description, setDescription] = useState<string | null>(null);
  const { collapsed, toggle } = useChatCollapsed();
  const { visible: watchlistVisible, setVisible: setWatchlistVisible } = useWatchlistVisible();
  const assetKey = `${selected.kind}:${selected.symbol}`;

  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:p-8">
      <aside
        className={`flex shrink-0 flex-col gap-6 lg:min-h-0 ${
          watchlistVisible ? "lg:w-60" : "lg:w-12"
        }`}
      >
        <div className="glass-tile rounded-3xl p-3 md:hidden">
          <AssetSearchBar />
        </div>
        {watchlistVisible ? (
          <div className="glass-tile flex min-h-0 flex-col rounded-3xl p-3 lg:max-h-none lg:flex-1">
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <ListOrdered className="h-3 w-3" />
                Watchlist
              </span>
              <span className="flex items-center gap-1">
                <span className="rounded-full border border-black/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  {watchlist.length}
                </span>
                <button
                  type="button"
                  onClick={() => setWatchlistVisible(false)}
                  aria-label="Hide watchlist sidebar"
                  title="Hide watchlist"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <Watchlist />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setWatchlistVisible(true)}
            aria-label="Show watchlist sidebar"
            title="Show watchlist"
            className="glass-tile flex w-full items-center justify-center gap-2 rounded-3xl px-3 py-3 transition hover:text-zinc-800 dark:hover:text-zinc-200 lg:h-full lg:flex-1 lg:flex-col lg:gap-3 lg:px-1"
          >
            <ListOrdered className="h-4 w-4 shrink-0" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 lg:[writing-mode:vertical-rl] lg:rotate-180">
              Watchlist
            </span>
          </button>
        )}
      </aside>

      <main className="grid min-w-0 flex-1 content-start grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <AssetChartPanel asset={selected} showSignals={false} />
        </div>

        {selected.kind === "crypto" && (
          <>
            <div className="lg:col-span-6">
              <SentimentIndex />
            </div>
            <div className="lg:col-span-6">
              <CrowdOdds symbol={selected.symbol} />
            </div>
          </>
        )}

        <div className="lg:col-span-4 lg:self-start">
          <AssetDescriptionPanel key={`desc-${assetKey}`} asset={selected} onLoaded={setDescription} />
        </div>

        <div className="lg:col-span-8">
          <NewsFeed key={`news-${assetKey}`} asset={selected} />
        </div>
      </main>

      <aside
        className={`flex shrink-0 flex-col gap-6 lg:min-h-0 ${
          collapsed ? "lg:w-12" : "lg:w-80"
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Show AI assistant"
            title="Show AI assistant"
            className="glass-tile flex w-full items-center justify-center gap-2 rounded-3xl px-3 py-3 transition hover:text-zinc-800 dark:hover:text-zinc-200 lg:h-full lg:flex-1 lg:flex-col lg:gap-3 lg:px-1"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 lg:[writing-mode:vertical-rl] lg:rotate-180">
              Assistant
            </span>
          </button>
        ) : (
          <ChatPanel
            key={assetKey}
            asset={selected}
            livePrice={livePrice}
            marketStats={marketStats}
            description={description}
            onCollapse={toggle}
          />
        )}
      </aside>
    </div>
  );
}
