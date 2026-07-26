"use client";

import { DEFAULT_WATCHLIST, type AssetRef, type MarketStats } from "@crypto-stocks/lib";
import { createContext, useContext, useState, type ReactNode } from "react";

const EMPTY_STATS: MarketStats = { sessionOpen: null, high: null, low: null, changePercent: null };

interface SelectedAssetState {
  selected: AssetRef;
  livePrice: number | null;
  marketStats: MarketStats;
  setSelected: (asset: AssetRef) => void;
  setLivePrice: (price: number | null) => void;
  setMarketStats: (stats: MarketStats) => void;
}

const SelectedAssetCtx = createContext<SelectedAssetState | null>(null);

export function SelectedAssetProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<AssetRef>(DEFAULT_WATCHLIST[0]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [marketStats, setMarketStats] = useState<MarketStats>(EMPTY_STATS);

  const setSelectedAndReset = (asset: AssetRef) => {
    setSelected(asset);
    setLivePrice(null);
    setMarketStats(EMPTY_STATS);
  };

  return (
    <SelectedAssetCtx.Provider
      value={{
        selected,
        livePrice,
        marketStats,
        setSelected: setSelectedAndReset,
        setLivePrice,
        setMarketStats,
      }}
    >
      {children}
    </SelectedAssetCtx.Provider>
  );
}

export function useSelectedAsset() {
  const ctx = useContext(SelectedAssetCtx);
  if (!ctx) throw new Error("useSelectedAsset must be used within SelectedAssetProvider");
  return ctx;
}
