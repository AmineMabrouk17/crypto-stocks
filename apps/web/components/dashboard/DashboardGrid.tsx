"use client";

import { EyeOff, PanelRightOpen, ListOrdered } from "lucide-react";
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
    <div className="grid w-full flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:p-8">
      <aside className="flex min-w-0 flex-col gap-6 lg:min-h-0">
        <div className="glass-tile rounded-3xl p-3 md:hidden">
          <AssetSearchBar />
        </div>
        {watchlistVisible ? (
          <div className="glass-tile flex min-h-0 max-h-80 flex-col rounded-3xl p-3 lg:max-h-none lg:flex-1">
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
            className="glass-tile flex items-center justify-center gap-2 rounded-3xl px-3 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ListOrdered className="h-3.5 w-3.5" />
            Watchlist
          </button>
        )}
      </aside>

      <main className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AssetChartPanel asset={selected} showSignals={false} />
        </div>

        <div className="flex min-h-[480px] lg:col-span-4">
          {collapsed ? (
            <div className="glass-tile flex w-full flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center">
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand AI assistant panel"
                title="Expand AI assistant"
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-500/20 dark:text-indigo-300"
              >
                <PanelRightOpen className="h-4 w-4" />
                Show AI assistant
              </button>
              <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                Ask about {selected.symbol} — price action, what it is, recent context.
              </p>
            </div>
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

        <div className="lg:col-span-4">
          <AssetDescriptionPanel key={`desc-${assetKey}`} asset={selected} onLoaded={setDescription} />
        </div>

        <div className="lg:col-span-8">
          <NewsFeed key={`news-${assetKey}`} asset={selected} />
        </div>
      </main>
    </div>
  );
}
