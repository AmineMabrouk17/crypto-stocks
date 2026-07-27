"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { useState } from "react";
import { ChatPanel } from "../chat/ChatPanel";
import { AssetChartPanel } from "../dashboard/AssetChartPanel";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { AssetDescriptionPanel } from "./AssetDescriptionPanel";

export function AssetDetailView({ asset }: { asset: AssetRef }) {
  const { livePrice, marketStats } = useSelectedAsset();
  const [description, setDescription] = useState<string | null>(null);

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
      <main className="flex flex-col gap-4">
        <AssetChartPanel asset={asset} />
        <AssetDescriptionPanel asset={asset} onLoaded={setDescription} />
      </main>
      <aside className="min-h-[420px] lg:min-h-0">
        <ChatPanel asset={asset} livePrice={livePrice} marketStats={marketStats} description={description} />
      </aside>
    </div>
  );
}
