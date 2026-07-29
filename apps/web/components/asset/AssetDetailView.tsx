"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { useState } from "react";
import { ChatPanel } from "../chat/ChatPanel";
import { AssetChartPanel } from "../dashboard/AssetChartPanel";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { AssetDescriptionPanel } from "./AssetDescriptionPanel";
import { NewsFeed } from "./NewsFeed";

export function AssetDetailView({ asset }: { asset: AssetRef }) {
  const { livePrice, marketStats } = useSelectedAsset();
  const [description, setDescription] = useState<string | null>(null);
  const assetKey = `${asset.kind}:${asset.symbol}`;

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
      <main className="flex flex-col gap-4">
        <AssetChartPanel asset={asset} />
        <AssetDescriptionPanel asset={asset} onLoaded={setDescription} />
        <NewsFeed key={assetKey} asset={asset} />
      </main>
      <aside className="h-[380px]">
        <ChatPanel asset={asset} livePrice={livePrice} marketStats={marketStats} description={description} />
      </aside>
    </div>
  );
}
