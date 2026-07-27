"use client";

import { PanelRightOpen } from "lucide-react";
import { useState } from "react";
import { useChatCollapsed } from "@/lib/useChatCollapsed";
import { AssetDescriptionPanel } from "../asset/AssetDescriptionPanel";
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
      className={`grid flex-1 grid-cols-1 gap-4 p-4 ${
        collapsed ? "lg:grid-cols-[260px_1fr_56px]" : "lg:grid-cols-[260px_1fr_320px]"
      }`}
    >
      <aside className="flex flex-col gap-3">
        <AssetSearchBar />
        <Watchlist />
      </aside>

      <main className="flex flex-col gap-4">
        <AssetChartPanel asset={selected} />
        <AssetDescriptionPanel key={assetKey} asset={selected} onLoaded={setDescription} />
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
        <aside className="min-h-[420px] lg:min-h-0">
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
