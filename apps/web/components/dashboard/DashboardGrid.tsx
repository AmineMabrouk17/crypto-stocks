"use client";

import { useState } from "react";
import { AssetDescriptionPanel } from "../asset/AssetDescriptionPanel";
import { ChatPanel } from "../chat/ChatPanel";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { AssetChartPanel } from "./AssetChartPanel";
import { AssetSearchBar } from "./AssetSearchBar";
import { Watchlist } from "./Watchlist";

export function DashboardGrid() {
  const { selected, livePrice } = useSelectedAsset();
  const [description, setDescription] = useState<string | null>(null);
  const assetKey = `${selected.kind}:${selected.symbol}`;

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[260px_1fr_320px]">
      <aside className="flex flex-col gap-3">
        <AssetSearchBar />
        <Watchlist />
      </aside>

      <main className="flex flex-col gap-4">
        <AssetChartPanel asset={selected} />
        <AssetDescriptionPanel key={assetKey} asset={selected} onLoaded={setDescription} />
      </main>

      <aside className="min-h-[420px] lg:min-h-0">
        <ChatPanel key={assetKey} asset={selected} livePrice={livePrice} description={description} />
      </aside>
    </div>
  );
}
