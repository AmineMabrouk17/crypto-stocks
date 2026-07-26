"use client";

import { DEFAULT_WATCHLIST, type AssetRef } from "@crypto-stocks/lib";
import { createContext, useContext, useState, type ReactNode } from "react";

interface SelectedAssetState {
  selected: AssetRef;
  livePrice: number | null;
  setSelected: (asset: AssetRef) => void;
  setLivePrice: (price: number | null) => void;
}

const SelectedAssetCtx = createContext<SelectedAssetState | null>(null);

export function SelectedAssetProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<AssetRef>(DEFAULT_WATCHLIST[0]);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const setSelectedAndReset = (asset: AssetRef) => {
    setSelected(asset);
    setLivePrice(null);
  };

  return (
    <SelectedAssetCtx.Provider
      value={{ selected, livePrice, setSelected: setSelectedAndReset, setLivePrice }}
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
