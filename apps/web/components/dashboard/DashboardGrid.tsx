"use client";

import { ChevronsLeft, ChevronsRight, ListOrdered, Sparkles } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
        className={cn(
          "flex shrink-0 flex-col gap-6 lg:min-h-0 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-7.5rem)] transition-[width] duration-300 ease-in-out",
          watchlistVisible ? "lg:w-60" : "lg:w-16"
        )}
      >
        <div className="glass-tile rounded-3xl p-3 md:hidden">
          <AssetSearchBar />
        </div>

        <div className="glass-tile flex min-h-0 flex-1 flex-col rounded-3xl p-3">
          {/* Header */}
          <div
            className={cn(
              "flex items-center pb-2",
              watchlistVisible ? "justify-between gap-2 px-1" : "justify-center"
            )}
          >
            {watchlistVisible ? (
              <>
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
                    aria-label="Collapse watchlist sidebar"
                    title="Collapse sidebar"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setWatchlistVisible(true)}
                aria-label="Expand watchlist sidebar"
                title="Expand watchlist"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
            <Watchlist collapsed={!watchlistVisible} />
          </div>
        </div>
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
        className={cn(
          "flex shrink-0 flex-col gap-6 lg:min-h-0 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-7.5rem)] transition-[width] duration-300 ease-in-out",
          collapsed ? "lg:w-12" : "lg:w-80"
        )}
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