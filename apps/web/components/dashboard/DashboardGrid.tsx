"use client";

import { PanelRightOpen } from "lucide-react";
import { useState } from "react";
import { useChatCollapsed } from "@/lib/useChatCollapsed";
import { AssetDescriptionPanel } from "../asset/AssetDescriptionPanel";
import { NewsFeed } from "../asset/NewsFeed";
import { ChatPanel } from "../chat/ChatPanel";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { AssetChartPanel } from "./AssetChartPanel";
import { AssetSearchBar } from "./AssetSearchBar";
import { Watchlist } from "./Watchlist";

export function DashboardGrid() {
  const { selected, livePrice, marketStats } = useSelectedAsset();
  const [description, setDescription] = useState<string | null>(null);
  const { collapsed, toggle } = useChatCollapsed();
  const assetKey = `${selected.kind}:${selected.symbol}`;

  return (
    <div
      className={`grid w-full flex-1 grid-cols-1 gap-4 p-4 ${
        collapsed ? "lg:grid-cols-[260px_1fr_56px]" : "lg:grid-cols-[260px_1fr_320px]"
      }`}
    >
      <aside className="flex flex-col">
        <div className="flex-shrink-0 pb-3">
          <AssetSearchBar />
        </div>
        <div className="flex-1 overflow-y-auto">
          <Watchlist />
        </div>
      </aside>

      <main className="flex flex-col gap-4">
        <AssetChartPanel asset={selected} />
        <AssetDescriptionPanel key={`desc-${assetKey}`} asset={selected} onLoaded={setDescription} />
        <NewsFeed key={`news-${assetKey}`} asset={selected} />
      </main>

      {collapsed ? (
        <div className="flex justify-center lg:justify-center">
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand AI assistant panel"
            title="Expand AI assistant"
            className="flex h-9 items-center justify-center gap-2 rounded-lg border border-black/10 px-4 text-sm text-zinc-500 hover:bg-black/5 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-white/10 lg:w-9 lg:px-0"
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="lg:hidden">Show AI assistant</span>
          </button>
        </div>
      ) : (
        <aside className="h-[380px]">
          <ChatPanel
            key={assetKey}
            asset={selected}
            livePrice={livePrice}
            marketStats={marketStats}
            description={description}
            onCollapse={toggle}
          />
        </aside>
      )}
    </div>
  );
}
