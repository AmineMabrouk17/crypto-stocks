"use client";

import type { AssetRef } from "@crypto-stocks/lib";
import { useCallback, useEffect, useState } from "react";
import { AnimatedBadge, type AnimatedBadgeStatus } from "../motion/animated-badge";
import { NumberTicker } from "../motion/number-ticker";
import { PriceChart, type PriceChartHandle } from "../chart/PriceChart";
import { useCryptoKlineStream } from "../chart/useCryptoKlineStream";
import { useStockPolling } from "../chart/useStockPolling";
import { useSelectedAsset } from "../providers/SelectedAssetContext";

function CryptoChart({ asset, chart }: { asset: AssetRef; chart: PriceChartHandle | null }) {
  const { setLivePrice, setMarketStats } = useSelectedAsset();
  const { price, stats, status } = useCryptoKlineStream(asset.symbol, chart);

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  return <StatusBadge status={status} price={price} />;
}

function StockChart({ asset, chart }: { asset: AssetRef; chart: PriceChartHandle | null }) {
  const { setLivePrice, setMarketStats } = useSelectedAsset();
  const { price, stats, status } = useStockPolling(asset.symbol, chart);

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  return <StatusBadge status={status} price={price} />;
}

const STATUS_TO_BADGE: Record<"connecting" | "open" | "closed", AnimatedBadgeStatus> = {
  connecting: "loading",
  open: "success",
  closed: "danger",
};

const STATUS_LABEL: Record<"connecting" | "open" | "closed", string> = {
  connecting: "Connecting",
  open: "Live",
  closed: "Disconnected",
};

function decimalsForPrice(price: number): number {
  if (price >= 1) return 2;
  if (price >= 0.01) return 4;
  return 6;
}

function StatusBadge({
  status,
  price,
}: {
  status: "connecting" | "open" | "closed";
  price: number | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-lg font-medium tabular-nums">
        {price != null ? (
          (() => {
            const decimals = decimalsForPrice(price);
            const scale = 10 ** decimals;
            return (
              <NumberTicker
                value={Math.round(price * scale)}
                duration={0.5}
                stagger={0.02}
                prefix="$"
                format={(n) =>
                  (n / scale).toLocaleString(undefined, {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                  })
                }
              />
            );
          })()
        ) : (
          "—"
        )}
      </span>
      <AnimatedBadge status={STATUS_TO_BADGE[status]} size="sm" contentKey={status}>
        {STATUS_LABEL[status]}
      </AnimatedBadge>
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
          <span className="font-mono text-sm font-normal text-zinc-500 dark:text-zinc-400">
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
