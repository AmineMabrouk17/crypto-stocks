"use client";

import { decimalsForPrice, formatCurrency, formatNumber, type AssetRef, type DayStats } from "@crypto-stocks/lib";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatedBadge, type AnimatedBadgeStatus } from "../motion/animated-badge";
import { NumberTicker } from "../motion/number-ticker";
import { PriceChart, type PriceChartHandle } from "../chart/PriceChart";
import { useCrypto24hStats } from "../chart/useCrypto24hStats";
import { useCryptoKlineStream } from "../chart/useCryptoKlineStream";
import { useStockPolling } from "../chart/useStockPolling";
import { useSelectedAsset } from "../providers/SelectedAssetContext";

function AssetHeader({
  asset,
  status,
  price,
  dayStats,
  windowLabel,
}: {
  asset: AssetRef;
  status: "connecting" | "open" | "closed";
  price: number | null;
  dayStats: DayStats;
  windowLabel: string;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          {asset.name}{" "}
          <span className="font-mono text-sm font-normal text-zinc-500 dark:text-zinc-400">
            {asset.symbol}
          </span>
          <Link
            href={
              asset.kind === "crypto"
                ? `/asset/${asset.symbol}?id=${encodeURIComponent(asset.id)}`
                : `/asset/${asset.symbol}`
            }
            aria-label={`Open ${asset.symbol} full page`}
            title="Open full page"
            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </h2>
        <DayStatsRow stats={dayStats} windowLabel={windowLabel} />
      </div>
      <StatusBadge status={status} price={price} />
    </div>
  );
}

function CryptoChart({ asset, chart }: { asset: AssetRef; chart: PriceChartHandle | null }) {
  const { setLivePrice, setMarketStats } = useSelectedAsset();
  const { price, stats, status } = useCryptoKlineStream(asset.symbol, chart);
  const dayStats = useCrypto24hStats(asset.symbol);

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  return <AssetHeader asset={asset} status={status} price={price} dayStats={dayStats} windowLabel="24h" />;
}

function StockChart({ asset, chart }: { asset: AssetRef; chart: PriceChartHandle | null }) {
  const { setLivePrice, setMarketStats } = useSelectedAsset();
  const { price, stats, dayStats, status } = useStockPolling(asset.symbol, chart);

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  return <AssetHeader asset={asset} status={status} price={price} dayStats={dayStats} windowLabel="Today" />;
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

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
  return volume.toLocaleString("en-US", { maximumFractionDigits: 0 });
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
                format={(n) => formatNumber(n / scale, decimals)}
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

function DayStatsRow({ stats, windowLabel }: { stats: DayStats; windowLabel: string }) {
  const hasAny = stats.changePercent != null || stats.high != null || stats.low != null;
  if (!hasAny) return null;

  const positive = (stats.changePercent ?? 0) >= 0;

  return (
    <div className="font-mono mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
      {stats.changePercent != null && (
        <span className={positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {positive ? "+" : ""}
          {stats.changePercent.toFixed(2)}% ({windowLabel})
        </span>
      )}
      {stats.high != null && <span>High {formatCurrency(stats.high)}</span>}
      {stats.low != null && <span>Low {formatCurrency(stats.low)}</span>}
      {stats.volume != null && <span>Vol {formatVolume(stats.volume)}</span>}
    </div>
  );
}

export function AssetChartPanel({ asset }: { asset: AssetRef }) {
  const [chartHandle, setChartHandle] = useState<PriceChartHandle | null>(null);
  const handleReady = useCallback((handle: PriceChartHandle) => setChartHandle(handle), []);

  return (
    <div className="flex flex-col gap-3">
      {asset.kind === "crypto" ? (
        <CryptoChart key={asset.symbol} asset={asset} chart={chartHandle} />
      ) : (
        <StockChart key={asset.symbol} asset={asset} chart={chartHandle} />
      )}
      <PriceChart onReady={handleReady} />
    </div>
  );
}
