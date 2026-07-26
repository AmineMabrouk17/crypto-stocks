"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { useCallback, useEffect, useState } from "react";
import { PriceChart, type PriceChartHandle } from "../chart/PriceChart";
import { useCryptoKlineStream } from "../chart/useCryptoKlineStream";
import { useStockPolling } from "../chart/useStockPolling";
import { useSelectedAsset } from "../providers/SelectedAssetContext";

function CryptoChart({ asset, chart }: { asset: AssetRef; chart: PriceChartHandle | null }) {
  const { setLivePrice } = useSelectedAsset();
  const { price, status } = useCryptoKlineStream(asset.symbol, chart);

  useEffect(() => {
    setLivePrice(price);
  }, [price, setLivePrice]);

  return <StatusBadge status={status} price={price} />;
}

function StockChart({ asset, chart }: { asset: AssetRef; chart: PriceChartHandle | null }) {
  const { setLivePrice } = useSelectedAsset();
  const { price, status } = useStockPolling(asset.symbol, chart);

  useEffect(() => {
    setLivePrice(price);
  }, [price, setLivePrice]);

  return <StatusBadge status={status} price={price} />;
}

function StatusBadge({
  status,
  price,
}: {
  status: "connecting" | "open" | "closed";
  price: number | null;
}) {
  const dotColor =
    status === "open" ? "bg-green-500" : status === "connecting" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {price != null ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : "—"}
      <span className="text-xs uppercase tracking-wide">{status}</span>
    </div>
  );
}

export function AssetChartPanel({ asset }: { asset: AssetRef }) {
  const [chartHandle, setChartHandle] = useState<PriceChartHandle | null>(null);
  const handleReady = useCallback((handle: PriceChartHandle) => setChartHandle(handle), []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {asset.name}{" "}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
            {asset.symbol}
          </span>
        </h2>
        {asset.kind === "crypto" ? (
          <CryptoChart key={asset.symbol} asset={asset} chart={chartHandle} />
        ) : (
          <StockChart key={asset.symbol} asset={asset} chart={chartHandle} />
        )}
      </div>
      <PriceChart onReady={handleReady} />
    </div>
  );
}
