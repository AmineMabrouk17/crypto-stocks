"use client";

import {
  CHART_TYPES,
  decimalsForPrice,
  formatCurrency,
  formatNumber,
  type AssetRef,
  type Candle,
  type ChartRange,
  type DayStats,
} from "@crypto-stocks/lib";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useChartRange } from "@/lib/useChartRange";
import { useChartType } from "@/lib/useChartType";
import { SharedLayoutBg } from "../motion/shared-layout-bg";
import { AnimatedBadge, type AnimatedBadgeStatus } from "../motion/animated-badge";
import { Loader } from "../motion/loader";
import { NumberTicker } from "../motion/number-ticker";
import { ChartRangeSelector } from "../chart/ChartRangeSelector";
import { MarketSignals } from "../chart/MarketSignals";
import { PriceChart, type PriceChartHandle } from "../chart/PriceChart";
import { useCrypto24hStats } from "../chart/useCrypto24hStats";
import { useCryptoKlineStream } from "../chart/useCryptoKlineStream";
import { useStockDayStats } from "../chart/useStockDayStats";
import { useStockPolling } from "../chart/useStockPolling";
import { useSelectedAsset } from "../providers/SelectedAssetContext";
import { PriceAlertPanel } from "./PriceAlertPanel";

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

function AssetHeader({
  asset,
  status,
  price,
}: {
  asset: AssetRef;
  status: "connecting" | "open" | "closed";
  price: number | null;
}) {
  return (
    <div className="flex items-start justify-between">
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
      <StatusBadge status={status} price={price} />
    </div>
  );
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

function StatsRow({ stats, windowLabel }: { stats: DayStats; windowLabel: string }) {
  const hasAny = stats.changePercent != null || stats.high != null || stats.low != null;
  if (!hasAny) return null;

  const positive = (stats.changePercent ?? 0) >= 0;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      {stats.changePercent != null && (
        <span
          className={`font-mono font-semibold ${
            positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {positive ? "+" : ""}
          {stats.changePercent.toFixed(2)}% ({windowLabel})
        </span>
      )}
      {stats.high != null && (
        <span className="font-mono text-zinc-600 dark:text-zinc-300">
          High <span className="font-semibold">{formatCurrency(stats.high)}</span>
        </span>
      )}
      {stats.low != null && (
        <span className="font-mono text-zinc-600 dark:text-zinc-300">
          Low <span className="font-semibold">{formatCurrency(stats.low)}</span>
        </span>
      )}
      {stats.volume != null && (
        <span className="font-mono text-zinc-600 dark:text-zinc-300">
          Vol <span className="font-semibold">{formatVolume(stats.volume)}</span>
        </span>
      )}
    </div>
  );
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportCandlesToCsv(asset: AssetRef, range: ChartRange, candles: Candle[]) {
  const header = "Time,Open,High,Low,Close";
  const rows = candles.map((c) => {
    const iso = new Date(c.time * 1000).toISOString();
    return `${iso},${c.open},${c.high},${c.low},${c.close}`;
  });
  const csv = [header, ...rows].join("\n");
  downloadTextFile(`${asset.symbol}_${range}.csv`, csv, "text/csv;charset=utf-8;");
}

export function AssetChartPanel({ asset }: { asset: AssetRef }) {
  const [chartHandle, setChartHandle] = useState<PriceChartHandle | null>(null);
  const { range, setRange } = useChartRange();
  const [chartType, setChartType] = useChartType();
  const handleReady = useCallback((handle: PriceChartHandle) => setChartHandle(handle), []);

  const { setLivePrice, setMarketStats } = useSelectedAsset();

  const {
    price: cryptoPrice,
    stats: cryptoStats,
    status: cryptoStatus,
    seeding: cryptoSeeding,
  } = useCryptoKlineStream(
    asset.kind === "crypto" ? asset.symbol : "",
    range,
    asset.kind === "crypto" ? chartHandle : null,
  );
  const cryptoDayStats = useCrypto24hStats(asset.kind === "crypto" ? asset.symbol : "");

  const {
    price: stockPrice,
    stats: stockStats,
    status: stockStatus,
    seeding: stockSeeding,
  } = useStockPolling(
    asset.kind === "stock" ? asset.symbol : "",
    range,
    asset.kind === "stock" ? chartHandle : null,
  );
  const stockDayStats = useStockDayStats(asset.kind === "stock" ? asset.symbol : "");

  const isCrypto = asset.kind === "crypto";
  const price = isCrypto ? cryptoPrice : stockPrice;
  const stats = isCrypto ? cryptoStats : stockStats;
  const status = isCrypto ? cryptoStatus : stockStatus;
  const streamSeeding = isCrypto ? cryptoSeeding : stockSeeding;
  const dayStats = isCrypto ? cryptoDayStats : stockDayStats;
  const windowLabel = isCrypto ? "24h" : "Today";

  useEffect(() => {
    setLivePrice(price);
    setMarketStats(stats);
  }, [price, stats, setLivePrice, setMarketStats]);

  const handleExportCsv = useCallback(() => {
    if (!chartHandle) return;
    const candles = chartHandle.getData();
    if (candles.length === 0) return;
    exportCandlesToCsv(asset, range, candles);
  }, [chartHandle, asset, range]);

  return (
    <div className="flex flex-col gap-3">
      <AssetHeader asset={asset} status={status} price={price} />
      <StatsRow stats={dayStats} windowLabel={windowLabel} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartRangeSelector range={range} onChange={setRange} />
          <SharedLayoutBg className="flex-row gap-0" pillClassName="bg-primary/[0.08] dark:bg-primary/[0.12]" inset={2}>
            {CHART_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setChartType(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  chartType === t ? "bg-foreground text-background" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {t === "area" ? "Area" : "Candle"}
              </button>
            ))}
          </SharedLayoutBg>
        </div>
        <div className="flex items-center gap-1">
          <PriceAlertPanel asset={asset} price={price} />
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!chartHandle}
            aria-label={`Export ${asset.symbol} chart data as CSV`}
            title="Export CSV"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="relative">
        {streamSeeding && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 backdrop-blur-sm dark:bg-zinc-950/60">
            <Loader variant="dots" size={28} />
          </div>
        )}
        <PriceChart onReady={handleReady} timeVisible={range === "1D" || range === "1W"} chartType={chartType} />
      </div>
      <MarketSignals asset={asset} />
    </div>
  );
}
